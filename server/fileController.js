const pdfParse = require("pdf-parse");
const fs = require("fs");
const csvParser = require("csv-parser");
const path = require("path");
const { GoogleGenerativeAIEmbeddings } = require("@langchain/google-genai");
const prisma = require("./config/db.js");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const embeddingModel = new GoogleGenerativeAIEmbeddings({
  model: "models/embedding-001",
  apiKey: process.env.GEMINI_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const vectorToBytes = (vector) => Buffer.from(new Float32Array(vector).buffer);
const bytesToVector = (bytes) => Array.from(new Float32Array(bytes));


// 1. Create Embedding from a PDF

const createEmbeddingFromPDF = async (req, res) => {
  try {
    const filePath = path.join(__dirname, "./pdfs", "CareerData .pdf");
    console.log(filePath);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    const fileBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(fileBuffer);
    const docText = pdfData.text.trim();

    if (!docText) {
      return res.status(400).json({ error: "PDF has no readable text" });
    }

    const chunks = splitTextIntoChunks(docText, 1000);

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

    res.json({ message: "Embeddings created and saved successfully ", filePath });
  } catch (error) {
    console.error("Error creating embedding:", error);
    res.status(500).json({ error: "Error creating embedding" });
  }
};


//2. Create Embedding from a CSV

const createEmbeddingFromCSV = async (req, res) => {
  try {
    const filePath = path.join(__dirname, "./pdfs", "ProfessionalCareersafter12th.pdf");
    console.log(filePath);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "CSV file not found" });
    }

    const rows = await readCSV(filePath);

    if (rows.length === 0) {
      return res.status(400).json({ error: "CSV file is empty" });
    }

    const rowTexts = rows.map((row) => Object.values(row).join(" "));

    const chunks = splitTextIntoChunks(rowTexts.join("\n"), 1000);

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

    res.json({ message: "CSV embeddings created and saved successfully" });
  } catch (error) {
    console.error("Error creating embedding from CSV:", error);
    res.status(500).json({ error: "Error creating embedding from CSV" });
  }
};

/**
 * 3. Helper: Read CSV file
 */
function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on("data", (data) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", (err) => reject(err));
  });
}


const query = async (req, res) => {
  try {
    const { question, conversationId, isFollowUp ,id} = req.body;
    console.log("Received question:", question);
    console.log("Received conversationId:", conversationId);
    console.log("Is follow-up:", isFollowUp);
    console.log("Received id:", id);

    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }

    let currentConversation = null;
    let context = "";
    let referencesArray = [];
    let followUpQuestion = "";
    let previousContext = "";

    // If this is a follow-up question, retrieve the conversation
    if (isFollowUp && id&&id!="career-guidance-home") {
      currentConversation = await prisma.conversation.findUnique({
        where: { id: id },
        include: { history: true }, // Include history
      });

      if (!currentConversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Retrieve the most recent conversation history to build context
      previousContext = currentConversation.history.length > 0 ? currentConversation.history[currentConversation.history.length - 1].context : "";
      followUpQuestion = currentConversation.history.length > 0 ? currentConversation.history[currentConversation.history.length - 1].followUpQuestion : "";
    }

    console.log("Previous context:", followUpQuestion);
    followUpQuestion = "Follow up question: " + followUpQuestion;
    console.log("followup"+followUpQuestion);
    let questionToProcess = question;
    if (isFollowUp && followUpQuestion) {
      const [questionEmbedding] = await embeddingModel.embedDocuments([question]);
      const [followUpEmbedding] = await embeddingModel.embedDocuments([followUpQuestion]);

      const similarity = cosineSimilarity(questionEmbedding, followUpEmbedding);
      console.log("Similarity between question and follow-up:", similarity);

      const shortFollowUps = ["yes", "yeah", "yup", "continue", "tell me more", "ok", "okay", "sure", "go ahead", "please continue"];

      const normalizedQuestion = question.trim().toLowerCase();

      if (similarity > 0.7 || shortFollowUps.includes(normalizedQuestion)) {
        console.log("Using follow-up question as main input.");
        questionToProcess = followUpQuestion;
      } else {
        console.log("Using original question as input.");
      }
    }

    // Generate embedding for the question
    const [queryEmbedding] = await embeddingModel.embedDocuments([questionToProcess]);

    // Retrieve documents from the database
    const documents = await prisma.document.findMany();

    if (documents.length === 0) {
      return res.status(404).json({ error: "No documents found" });
    }

    // Calculate similarity scores
    const scoredDocs = documents.map((doc) => {
      const docEmbedding = bytesToVector(doc.embedding);
      const score = cosineSimilarity(queryEmbedding, docEmbedding);
      return { ...doc, score };
    });

    // Get top 3 documents
    const topDocuments = scoredDocs
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    // Combine context from top documents and previous context (if follow-up)
    context = topDocuments.map((doc) => doc.content).join("\n---\n");
    if (previousContext && isFollowUp) {
      context = `${previousContext}\n---\n${context}`;
    }

    // Create references array
    referencesArray = topDocuments.map((doc, index) => ({
      reference_number: index + 1,
      preview: doc.content.slice(0, 200) + "...",
    }));

    const referencesText = referencesArray
      .map((ref) => `Reference ${ref.reference_number}: "${ref.preview}"`)
      .join("\n");

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

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", temperature: 0.7 });

    // Generate main answer
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `
${systemPrompt}

Context:
${context}

Question: ${questionToProcess}
            `.trim(),
            },
          ],
        },
      ],
    });

    const response = result.response;
    const answer = response.text().trim();

    // Generate follow-up question
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

    const followUpResult = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: followUpPrompt }],
        },
      ],
    });

    followUpQuestion = followUpResult.response.text().trim();

    // If conversation exists, update the conversation history, otherwise create a new conversation
    if (!currentConversation) {
      currentConversation = await prisma.conversation.create({
        data: {
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
      // Create new conversation history for each question-answer pair
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

    // Send response
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
  const topics = text.split(/(?=LAW|ENGINEERING|MEDICAL|BUSINESS MANAGEMENT|DESIGN|HOTEL MANAGEMENT|MASS COMMUNICATION|COMMERCE|ARTS\/HUMANITIES|PURE SCIENCE|SPORTS|PERFORMING ARTS|LIBERAL STUDIES|ECONOMICS|SOCIAL WORK)/)//); // Keep your regex
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

/**
 * 6. Helper: Cosine Similarity
 */
function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
  const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (normA * normB);
}

const fetchConversationHistory = async (req, res) => {
  try {
    const { conversationId } = req.params;  // Get conversationId from route params

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: "Conversation ID is required",
      });
    }

    console.log(`Fetching history for conversation ID: ${conversationId}...`);

    // Fetch the conversation with the provided conversationId
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    // Fetch the conversation history for this specific conversation
    const conversationHistory = await prisma.conversationHistory.findMany({
      where: {
        conversationId: conversationId,
      },
      orderBy: {
        createdAt: "desc", // Fetch the latest messages first
      },
    });

    if (conversationHistory.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No conversation history found for this conversation",
      });
    }

    // Get the latest message from the conversation history (last entry)
    const latestMessage = conversationHistory[0];

    res.json({
      success: true,
     id: conversationHistory.id,
    conver: conversationId,    // Return the conversation ID
      latestMessage,        // Return the latest message in the history
      history: conversationHistory,  // Optionally return the full history
    });

  } catch (error) {
    console.error("Error fetching conversation history:", error);
    res.status(500).json({ error: "Error fetching conversation history" });
  }
};

const fetchAllConversationsh = async (req, res) => {
  const {id} = req.body;
  try {
    console.log("Fetching all conversations...");

    // Fetch all conversations ordered by creation time
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

    // Extract all conversation IDs
    const conversationIds = conversations.map((conversation) => conversation.id);

    res.json({
      success: true,
      data: conversationIds, // All conversation IDs
    });

  } catch (error) {
    console.error("Error fetching conversation IDs:", error);
    res.status(500).json({ error: "Error fetching conversation IDs" });
  }
};

const conversationHistory = async (req, res) => {
  try {
    const { id ,uid} = req.body;

    // Fetch the conversation history for the given conversation ID
    const history = await prisma.conversationHistory.findMany({
      where: {
        conversationId: id, // Ensure we filter by conversationId
      },
      orderBy: { createdAt: "asc" }, // Order by creation time
    });

    if (!history || history.length === 0) {
      return res.status(200).json({ error: "No history found for this conversation" });
    }

    console.log("Fetched conversation history:", history.length, id);

    res.json({ success: true, data: history,iddd: history.id });
  } catch (error) {
    console.error("Error fetching conversation history:", error);
    res.status(500).json({ error: "Error fetching conversation history" });
  }
};

const createConversation= async (req, res) => {
  try {
    const { id, uid } = req.body;
    const createdAt = new Date();
    // Create a new conversation
    const newConversation = await prisma.conversation.create({
      
      data: {
        id: id,
        userId: uid,
        createdAt: createdAt,
        history: {
          create: [], // Initialize with an empty history
        },
      },
    });

    res.status(201).json({ success: true, data: newConversation });
  } catch (error) {
    console.error("Error creating conversation:", error);
    res.status(500).json({ error: "Error creating conversation" });
  }
};
module.exports = { createEmbeddingFromPDF, query, createEmbeddingFromCSV ,fetchConversationHistory,fetchAllConversationsh,conversationHistory,createConversation};