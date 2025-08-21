const pdfParse = require("pdf-parse");
const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAIEmbeddings } = require("@langchain/google-genai");
const prisma = require("./config/db.js");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

const embeddingModel = new GoogleGenerativeAIEmbeddings({
  model: "models/embedding-001",
  apiKey: process.env.GEMINI_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const vectorToBytes = (vector) => Buffer.from(new Float32Array(vector).buffer);
const bytesToVector = (bytes) => Array.from(new Float32Array(bytes));

// Helper: Create embedding from PDF and save to database
const createEmbeddingFromPDF = async (req, res) => {
  try {
    const pdfsDirectory = path.join(__dirname, "./pdfs");
    console.log(`Looking for PDFs in: ${pdfsDirectory}`);

    // 1. Get a list of all files in the directory
    const pdfFiles = fs.readdirSync(pdfsDirectory).filter(file => file.endsWith('.pdf'));

    if (pdfFiles.length === 0) {
      return res.status(404).json({ error: "No PDF files found in the ./pdfs directory" });
    }

    console.log(`Found ${pdfFiles.length} PDF files to process:`, pdfFiles);
    
    // Clear existing documents to avoid duplicates
    await prisma.document.deleteMany({});
    console.log("Cleared existing documents from the database.");

    // 2. Loop through each PDF file and process it
    for (const pdfFile of pdfFiles) {
      const filePath = path.join(pdfsDirectory, pdfFile);
      console.log(`--- Processing ${pdfFile} ---`);

      const fileBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(fileBuffer);
      const docText = pdfData.text.trim();

      if (!docText) {
        console.warn(`Skipping ${pdfFile} as it has no readable text.`);
        continue; // Skip to the next file
      }

      const chunks = splitTextIntoChunks(docText, 1000);
      console.log(`Split ${pdfFile} into ${chunks.length} chunks.`);

      console.log(`Creating embeddings for ${pdfFile}...`);
      const embeddings = await embeddingModel.embedDocuments(chunks);
      
      const createPromises = chunks.map((chunk, index) => {
        return prisma.document.create({
          data: {
            content: chunk,
            embedding: vectorToBytes(embeddings[index]),
          },
        });
      });

      await Promise.all(createPromises);
      console.log(`Successfully created and saved embeddings for ${pdfFile}.`);
    }

    res.json({ message: `Embeddings for all ${pdfFiles.length} PDFs created and saved successfully.` });

  } catch (error) {
    console.error("DETAILED EMBEDDING ERROR:", error);
    res.status(500).json({ error: "Error creating embeddings" });
  }
};

//Helper : Query function to process user questions and generate responses
const query = async (req, res) => {
  try {
    // ✅ Destructure userId from the request body
    const { question, isFollowUp, id: conversationIdFromRequest, userId } = req.body;
    console.log("Received conversation id:", conversationIdFromRequest);
    console.log("Received user id:", userId);
    console.log("Received question:", question);
    console.log("Is follow-up:", isFollowUp);
    console.log("Received conversation id:", conversationIdFromRequest);
    console.log("Received user id:", userId);

    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }

    let currentConversation = null;
    let context = "";
    let referencesArray = [];
    let followUpQuestion = "";
    let previousContext = "";

    // If this is a follow-up question, retrieve the conversation
    if (isFollowUp && conversationIdFromRequest && conversationIdFromRequest !== "career-guidance-home") {
      currentConversation = await prisma.conversation.findUnique({
        where: { id: conversationIdFromRequest },
        include: { history: { orderBy: { createdAt: 'asc' } } },
      });

      if (currentConversation) {
        // Retrieve context only if conversation was found
        const lastHistory = currentConversation.history[currentConversation.history.length - 1];
        if (lastHistory) {
            previousContext = lastHistory.context;
            followUpQuestion = lastHistory.followUpQuestion;
        }
      }
    }
    
    let questionToProcess = question;
    if (isFollowUp && followUpQuestion) {
      const [questionEmbedding] = await embeddingModel.embedDocuments([question]);
      const [followUpEmbedding] = await embeddingModel.embedDocuments([`Follow up question: ${followUpQuestion}`]);
      const similarity = cosineSimilarity(questionEmbedding, followUpEmbedding);
      const shortFollowUps = ["yes", "yeah", "yup", "continue", "tell me more", "ok", "okay", "sure", "go ahead", "please continue"];
      const normalizedQuestion = question.trim().toLowerCase();
      if (similarity > 0.7 || shortFollowUps.includes(normalizedQuestion)) {
        questionToProcess = followUpQuestion;
      }
    }

    const [queryEmbedding] = await embeddingModel.embedDocuments([questionToProcess]);
    const documents = await prisma.document.findMany();

    if (documents.length === 0) {
      return res.status(404).json({ error: "No documents found" });
    }

    const scoredDocs = documents.map((doc) => ({
      ...doc,
      score: cosineSimilarity(queryEmbedding, bytesToVector(doc.embedding)),
    }));

    const topDocuments = scoredDocs.sort((a, b) => b.score - a.score).slice(0, 10);
    context = topDocuments.map((doc) => doc.content).join("\n---\n");
    if (previousContext && isFollowUp) {
      context = `${previousContext}\n---\n${context}`;
    }

    referencesArray = topDocuments.map((doc, index) => ({
      reference_number: index + 1,
      preview: doc.content.slice(0, 200) + "...",
    }));

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", temperature: 0.7 });
    const systemPrompt = `
You are a professional career counselor specialized in guiding students toward optimal career paths based on provided information. Your responses should be clear, structured, and encouraging, using bullet points, headings, and **bold text**.

Your Tasks:
- Identify career paths, education, entrance exams, skills, based on CONTEXT only.
- Answer the user's question properly based on context.
- Be very positive and helpful.

Rules:
- If context is missing info, reply "I don't have sufficient information."
- Do NOT add random data.
- Be specific, clear, and positive.
`;
    const result = await model.generateContent(`${systemPrompt}\nContext:${context}\nQuestion: ${questionToProcess}`);
    const answer = result.response.text().trim();

    const referencesText = referencesArray.map(ref => `Reference ${ref.reference_number}: "${ref.preview}"`).join("\n");
    const followUpPrompt = `
You are a smart assistant helping users to ask better career-related questions.

Given these references:

${referencesText}

Generate a meaningful and natural follow-up question that the user might logically ask next, based on the above references and user's last question.

Guidelines:
- Only one follow-up question.
- It should be highly related to the topics mentioned.
- Do not create random or unrelated questions.
- Example follow-up words: "Would you like to explore...", "Are you interested in knowing more about...", "Would you like me to suggest..."
`;
    const followUpResult = await model.generateContent(followUpPrompt);
    followUpQuestion = followUpResult.response.text().trim();


    // If conversation exists, update its history, otherwise create a new conversation
    if (!currentConversation) {
        if (!userId) {
            return res.status(400).json({ error: "User ID is required for a new conversation." });
        }
        const newConversationId = conversationIdFromRequest || uuidv4();
        currentConversation = await prisma.conversation.create({
            data: {
                id: newConversationId,
                userId: userId,
                history: {
                    create: [
                        {
                            question,
                            answer,
                            context,
                            followUpQuestion,
                            references: JSON.stringify(referencesArray),
                        },
                    ],
                },
            },
        });
    } else {
      await prisma.conversationHistory.create({
        data: {
          question,
          answer,
          context,
          followUpQuestion,
          references: JSON.stringify(referencesArray),
          conversationId: currentConversation.id,
        },
      });
    }

    res.json({
      success: true,
      data: {
        answer,
        follow_up: followUpQuestion,
        references: referencesArray,
        conversationId: currentConversation.id,
      },
    });
  } catch (error) {
    console.error("Error processing query:", error);
    res.status(500).json({ error: "Error processing query" });
  }
};

function splitTextIntoChunks(text, maxLength = 1000) {
  const topics = text.split(/(?=LAW|ENGINEERING|MEDICAL|BUSINESS MANAGEMENT|DESIGN|HOTEL MANAGEMENT|MASS COMMUNICATION|COMMERCE|ARTS\/HUMANITIES|PURE SCIENCE|SPORTS|PERFORMING ARTS|LIBERAL STUDIES|ECONOMICS|SOCIAL WORK)/)
  const chunks = [];
  topics.forEach((topic) => {
    let start = 0;
    while (start < topic.length) {
      const end = start + maxLength;
      const chunk = topic.slice(start, end).trim();
      if (chunk) chunks.push(chunk);
      start = end;
    }
  });
  return chunks;
}

function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
  const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (normA * normB);
}

const fetchConversationHistory = async (req, res) => {
  try {
    const { conversationId } = req.params; 

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: "Conversation ID is required",
      });
    }

    console.log(`Fetching history for conversation ID: ${conversationId}...`);

    const conversationHistory = await prisma.conversationHistory.findMany({
      where: {
        conversationId: conversationId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (conversationHistory.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No conversation history found for this conversation",
      });
    }

    const latestMessage = conversationHistory[0];

    res.json({
      success: true,
      id: latestMessage.id, // ID of the latest message
      conver: conversationId,
      latestMessage,
      history: conversationHistory,
    });

  } catch (error) {
    console.error("Error fetching conversation history:", error);
    res.status(500).json({ error: "Error fetching conversation history" });
  }
};

const fetchAllConversationsh = async (req, res) => {
  const {id} = req.body;
  try {
    console.log(`Fetching all conversations for user: ${id}...`);

    if (!id) {
        return res.status(400).json({ success: false, message: "User ID is required." });
    }

    const conversations = await prisma.conversation.findMany({
      where:{
        userId: id
      },
      orderBy: { createdAt: "desc" },
    });

    if (conversations.length === 0) {
      return res.json({
        success: false,
        message: "No conversations found",
      });
    }

    const conversationIds = conversations.map((conversation) => conversation.id);

    res.json({
      success: true,
      data: conversationIds,
    });

  } catch (error) {
    console.error("Error fetching conversation IDs:", error);
    res.status(500).json({ error: "Error fetching conversation IDs" });
  }
};

const conversationHistory = async (req, res) => {
  try {
    const { id } = req.body; // uid is not used here

    const history = await prisma.conversationHistory.findMany({
      where: {
        conversationId: id,
      },
      orderBy: { createdAt: "asc" },
    });

    if (!history || history.length === 0) {
      // Return success: false to align with frontend expectations
      return res.json({ success: false, error: "No history found for this conversation" });
    }

    console.log("Fetched conversation history:", history.length, id);

    res.json({ success: true, data: history });
  } catch (error) {
    console.error("Error fetching conversation history:", error);
    res.status(500).json({ error: "Error fetching conversation history" });
  }
};

const createConversation = async (req, res) => {
  try {
    const { id, uid } = req.body;
    
    if (!id || !uid) {
        return res.status(400).json({ success: false, error: "Conversation ID and User ID are required."});
    }

    const newConversation = await prisma.conversation.create({
      data: {
        id: id,
        userId: uid,
        // Prisma's @default(now()) handles createdAt, so no need to pass it
      },
    });

    res.status(201).json({ success: true, data: newConversation });
  } catch (error) {
    console.error("Error creating conversation:", error);
    res.status(500).json({ error: "Error creating conversation" });
  }
};

module.exports = { createEmbeddingFromPDF, query, fetchConversationHistory, fetchAllConversationsh, conversationHistory, createConversation };
