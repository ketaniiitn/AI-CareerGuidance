const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const prisma = require("../config/db");
const { embedTexts } = require("../lib/embeddings");
const { advancedChunk, extractKeywords, extractProbableTitle } = require("../lib/chunking");
const { deriveTaxonomy } = require("../lib/taxonomy");
const { ensureBM25Index } = require("../lib/bm25");
const { ensureCollection, clearCollection, upsertVectors } = require("../lib/qdrant");
const { l2Norm } = require("../lib/retrieval");

const vectorToBytes = (vector) => Buffer.from(new Float32Array(vector).buffer);

const createEmbeddingFromPDF = async (req, res) => {
  try {
    const pdfsDir = path.join(__dirname, "../pdfs");
    const pdfFiles = fs.readdirSync(pdfsDir).filter(f => f.toLowerCase().endsWith(".pdf"));

    if (pdfFiles.length === 0) {
      return res.status(404).json({ error: "No PDF files found in ./pdfs directory" });
    }

    await prisma.document.deleteMany({});
    await clearCollection();
    await ensureCollection();

    const processed = [], skipped = [];

    for (const pdfFile of pdfFiles) {
      const filePath = path.join(pdfsDir, pdfFile);
      let pdfData;
      try {
        pdfData = await pdfParse(fs.readFileSync(filePath));
      } catch (e) {
        skipped.push({ file: pdfFile, reason: "parse_error" });
        continue;
      }

      const raw = (pdfData.text || "").trim();
      if (!raw || raw.length < 120) {
        skipped.push({ file: pdfFile, reason: raw ? "too_short" : "no_text", chars: raw.length });
        continue;
      }

      let chunks = advancedChunk(raw, { maxTokens: 420, overlapTokens: 50 });
      // Split oversized chunks
      chunks = chunks.flatMap(c => {
        const words = c.split(/\s+/);
        if (words.length <= 600) return [c];
        const mid = Math.floor(words.length / 2);
        return [words.slice(0, mid + 50).join(" "), words.slice(mid - 50).join(" ")];
      });

      let embeddings;
      try {
        embeddings = await embedTexts(chunks);
      } catch (e) {
        console.error(`Embedding failed for ${pdfFile}:`, e.message, e?.status, e?.errorDetails);
        skipped.push({ file: pdfFile, reason: "embedding_error", error: e.message });
        continue;
      }

      const qdrantPoints = [];
      for (let i = 0; i < chunks.length; i++) {
        const emb = embeddings[i];
        if (!emb) continue;
        const content = chunks[i];
        const taxonomy = deriveTaxonomy(content);
        const doc = await prisma.document.create({
          data: {
            content,
            embedding: vectorToBytes(emb),
            sourceFile: pdfFile,
            chunkIndex: i,
            sectionTitle: extractProbableTitle(content),
            tokenCount: content.split(/\s+/).length,
            keywords: extractKeywords(content),
            embeddingNorm: l2Norm(emb),
            stream: taxonomy.stream,
            exams: JSON.stringify(taxonomy.exams),
            degrees: JSON.stringify(taxonomy.degrees),
            skills: JSON.stringify(taxonomy.skills),
          },
        });
        qdrantPoints.push({ id: doc.id, vector: emb, payload: { sourceFile: pdfFile, stream: taxonomy.stream } });
      }

      await upsertVectors(qdrantPoints);
      processed.push({ file: pdfFile, chunks: chunks.length });
    }

    const allDocs = await prisma.document.findMany();
    ensureBM25Index(allDocs);

    res.json({
      message: "Embedding pass complete.",
      processed,
      skipped,
      totals: { processed: processed.length, skipped: skipped.length, documents: allDocs.length },
    });
  } catch (error) {
    console.error("Embedding error:", error);
    res.status(500).json({ error: "Error creating embeddings", detail: error.message });
  }
};

module.exports = { createEmbeddingFromPDF };
