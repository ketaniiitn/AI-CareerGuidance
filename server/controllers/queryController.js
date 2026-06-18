const { v4: uuidv4 } = require("uuid");
const prisma = require("../config/db");
const { embedTexts } = require("../lib/embeddings");
const { getModel } = require("../lib/gemini");
const { hybridRetrieve } = require("../lib/retrieval");
const { detectDomainTerm, DOMAIN_CONFIG, DOMAIN_KEYWORDS } = require("../lib/domainConfig");
const { inferProfileSignals } = require("../lib/profileInference");
const { searchVectors } = require("../lib/qdrant");

function cleanQuery(q = "") {
  return q.replace(/\s+/g, " ").replace(/[​-‍﻿]/g, "").trim();
}

function detectIntent(normalizedQ, followUpQuestion) {
  if (/(what are (the )?sources|source of|where (did|does) this (come|came) from|cite|citations?)/i.test(normalizedQ)) return "request_sources";
  if (/(not interested|don't want|do not want|no i am not|no i'm not|not into)/i.test(normalizedQ)) return "negative_rejection";
  if (/^(yes|yeah|yup|sure|okay|ok|please do|go ahead)\b/.test(normalizedQ) && followUpQuestion) return "followup_accept";
  if (DOMAIN_KEYWORDS.some(k => normalizedQ.includes(k))) return "domain_focus";
  return "general";
}

function buildSystemPrompt(intent, domainTerm) {
  if (intent === "domain_focus") {
    return `You are a precise career guidance assistant.
RULES:
1. Use ONLY the supplied context — no external knowledge.
2. If info is missing say: "I don't have sufficient information."
3. Structure: Overview → Key Roles → Pathways & Entrance Exams → Core Skills → Practical Next Steps.
4. Focus on domain: ${domainTerm || "requested domain"}. Ignore unrelated streams.
5. Short, high-signal bullets. No fluff.
6. End with ONE clarifying question if personalization is incomplete.`;
  }
  return `You are a precise career guidance assistant.
Rules: use ONLY the supplied context; concise bullets; do not hallucinate; highlight actionable next steps; one clarifying question at end if needed.`;
}

// SSE helper
function sendEvent(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

const query = async (req, res) => {
  const { question, isFollowUp, id: conversationIdFromRequest, userId, debug } = req.body;

  if (!question) return res.status(400).json({ error: "Question is required" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    // --- Load conversation context if follow-up ---
    let currentConversation = null;
    let previousContext = "", lastFollowUp = "";

    if (isFollowUp && conversationIdFromRequest && conversationIdFromRequest !== "career-guidance-home") {
      currentConversation = await prisma.conversation.findUnique({
        where: { id: conversationIdFromRequest },
        include: { history: { orderBy: { createdAt: "asc" } } },
      });
      if (currentConversation?.history?.length) {
        const last = currentConversation.history[currentConversation.history.length - 1];
        previousContext = last.context;
        lastFollowUp = last.followUpQuestion;
      }
    }

    // --- Intent & question resolution ---
    const cleanedQuestion = cleanQuery(question);
    const normalizedQ = cleanedQuestion.toLowerCase();
    const intent = detectIntent(normalizedQ, lastFollowUp);
    const questionToProcess = intent === "followup_accept" && lastFollowUp ? lastFollowUp : cleanedQuestion;

    // --- Domain + query expansion ---
    const domainTerm = detectDomainTerm(normalizedQ);
    let retrievalQuestion = questionToProcess;
    if (domainTerm && DOMAIN_CONFIG[domainTerm]?.expansions?.length) {
      retrievalQuestion += " " + DOMAIN_CONFIG[domainTerm].expansions.join(" ");
    }

    // --- Embed query ---
    const [queryEmbedding] = await embedTexts([questionToProcess]);

    // --- Fetch documents (Qdrant-first, Prisma fallback) ---
    let documents;
    const qdrantResults = await searchVectors(queryEmbedding, 40);
    if (qdrantResults?.length) {
      const ids = qdrantResults.map(r => Number(r.id));
      documents = await prisma.document.findMany({ where: { id: { in: ids } } });
    } else {
      documents = await prisma.document.findMany();
    }

    if (documents.length === 0) {
      sendEvent(res, { type: "error", message: "No documents found. Please run /file/pdf first." });
      return res.end();
    }

    // --- Profile inference from history ---
    let profileType = null;
    if (currentConversation?.history?.length) {
      const recentTexts = currentConversation.history.slice(-6).map(h => `${h.question} ${h.answer}`);
      profileType = inferProfileSignals(questionToProcess, recentTexts).profileType;
    }

    // --- Retrieval ---
    const topDocuments = hybridRetrieve({ documents, queryEmbedding, retrievalQuestion, domainTerm, profileType });
    let context = topDocuments.map(d => d.content).join("\n---\n");
    if (previousContext && isFollowUp) context = `${previousContext}\n---\n${context}`;

    const referencesArray = topDocuments.map((doc, i) => ({
      reference_number: i + 1,
      source: doc.sourceFile || "unknown",
      score: Number((doc.rerank || doc.fused || doc.cos || 0).toFixed(4)),
      stream: doc.stream || null,
    }));

    // --- Generation (streaming) ---
    const model = getModel(0.65);
    let answer = "";

    if (intent === "request_sources") {
      const sources = [...new Set(referencesArray.map(r => r.source))];
      answer = "Sources for the last answer:\n" + sources.map(s => `• ${s}`).join("\n");
      sendEvent(res, { type: "token", content: answer });
    } else if (intent === "negative_rejection") {
      answer = "Understood — you want to shift focus. Please name one or two interest areas so I can give targeted guidance (e.g., law, data, design, hospitality, economics, engineering).";
      sendEvent(res, { type: "token", content: answer });
    } else {
      const prompt = `${buildSystemPrompt(intent, domainTerm)}\nContext:\n${context}\nUser Question: ${questionToProcess}`;
      try {
        const stream = await model.generateContentStream(prompt);
        for await (const chunk of stream.stream) {
          const text = chunk.text();
          if (text) {
            answer += text;
            sendEvent(res, { type: "token", content: text });
          }
        }
      } catch (genErr) {
        console.error("Generation failed:", genErr.message);
        answer = "I'm temporarily unable to generate a detailed answer. Please try again shortly.";
        sendEvent(res, { type: "token", content: answer });
      }
    }

    // --- Follow-up generation ---
    let followUpQuestion = "";
    try {
      if (intent === "request_sources") {
        followUpQuestion = "Need details on any specific domain? (e.g., law, engineering, design)";
      } else if (intent === "negative_rejection") {
        followUpQuestion = "Which 1–2 areas would you like to explore instead?";
      } else {
        const refsCompact = [...new Set(referencesArray.map(r => r.source))].slice(0, 5).join(", ");
        const fuResult = await getModel(0.7).generateContent(
          `Provide ONE short (<=18 words) follow-up question that deepens the user's exploration without being yes/no. Sources: ${refsCompact}`
        );
        followUpQuestion = fuResult.response.text().trim();
      }
    } catch {
      followUpQuestion = "Would you like to explore another domain or go deeper on this one?";
    }

    // --- Persist to DB ---
    if (!currentConversation) {
      if (!userId) {
        sendEvent(res, { type: "error", message: "User ID is required for a new conversation." });
        return res.end();
      }
      currentConversation = await prisma.conversation.create({
        data: {
          id: conversationIdFromRequest || uuidv4(),
          userId,
          history: {
            create: [{ question, answer, context, followUpQuestion, references: JSON.stringify(referencesArray) }],
          },
        },
      });
    } else {
      await prisma.conversationHistory.create({
        data: { question, answer, context, followUpQuestion, references: JSON.stringify(referencesArray), conversationId: currentConversation.id },
      });
      for (const [idx, doc] of topDocuments.entries()) {
        await prisma.document.update({
          where: { id: doc.id },
          data: {
            usageCount: { increment: 1 },
            avgRank: doc.avgRank
              ? ((doc.avgRank * (doc.usageCount || 1)) + (idx + 1)) / ((doc.usageCount || 1) + 1)
              : idx + 1,
          },
        });
      }
    }

    sendEvent(res, {
      type: "done",
      conversationId: currentConversation.id,
      follow_up: followUpQuestion,
      references: referencesArray,
      profileType: profileType || null,
      ...(debug && { debug: { intent, domainTerm, profileType } }),
    });

    res.end();
  } catch (error) {
    console.error("Query error:", error);
    sendEvent(res, { type: "error", message: "Error processing query" });
    res.end();
  }
};

module.exports = { query };
