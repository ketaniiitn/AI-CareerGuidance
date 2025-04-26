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

/**
 * 1. Create Embedding from a PDF
 */
const createEmbeddingFromPDF = async (req, res) => {
  try {
    const filePath = path.join(__dirname, "./pdfs", "Career_Planner.pdf");
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

    // Split the text into smaller chunks (e.g., 500-1000 characters)
    const chunks = splitTextIntoChunks(docText, 1000);

    const embeddings = await embeddingModel.embedDocuments(chunks);

    // Save each chunk with its corresponding embedding
    const createPromises = chunks.map((chunk, index) => {
      return prisma.document.create({
        data: {
          content: chunk,
          embedding: vectorToBytes(embeddings[index]),
        },
      });
    });

    await Promise.all(createPromises);

    res.json({ message: "Embeddings created and saved successfully" });
  } catch (error) {
    console.error("Error creating embedding:", error);
    res.status(500).json({ error: "Error creating embedding" });
  }
};

const createEmbeddingFromCSV = async (req, res) => {
    try {
      const filePath = path.join(__dirname, "./pdfs", "Career_Planner.pdf");
      console.log(filePath);
  
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "CSV file not found" });
      }
  
      const rows = await readCSV(filePath);
  
      if (rows.length === 0) {
        return res.status(400).json({ error: "CSV file is empty" });
      }
  
      // Combine all rows into a single text per row
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
/**
 * 2. Query on stored embeddings
 */
const query = async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }

    const [queryEmbedding] = await embeddingModel.embedDocuments([question]);

    const documents = await prisma.document.findMany();

    if (documents.length === 0) {
      return res.status(404).json({ error: "No documents found" });
    }

    // Find top 3 most similar chunks
    const scoredDocs = documents.map((doc) => {
      const docEmbedding = bytesToVector(doc.embedding);
      const score = cosineSimilarity(queryEmbedding, docEmbedding);
      return { ...doc, score };
    });

    const topDocuments = scoredDocs
      .sort((a, b) => b.score - a.score)
      .slice(0, 3); // Take top 3

    const context = topDocuments.map((doc) => doc.content).join("\n---\n");

    const prompt = `Context:\n${context}\n\nQuestion: ${question}\nAnswer (based only on the context above):`;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    res.json({ answer: text.trim() });
  } catch (error) {
    console.error("Error processing query:", error);
    res.status(500).json({ error: "Error processing query" });
  }
};

/**
 * Helper: Split long text into smaller chunks
 */
function splitTextIntoChunks(text, maxLength) {
  const sentences = text.split(/(?<=[.?!])\s+/);
  const chunks = [];
  let chunk = "";

  for (const sentence of sentences) {
    if ((chunk + sentence).length > maxLength) {
      chunks.push(chunk.trim());
      chunk = "";
    }
    chunk += sentence + " ";
  }

  if (chunk.trim().length > 0) {
    chunks.push(chunk.trim());
  }

  return chunks;
}

/**
 * Helper: Cosine Similarity between two vectors
 */
function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
  const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (normA * normB);
}

module.exports = { createEmbeddingFromPDF, query,createEmbeddingFromCSV };
