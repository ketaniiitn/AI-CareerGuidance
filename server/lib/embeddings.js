require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
console.log("Gemini Key Exists:", !!process.env.GEMINI_API_KEY);
console.log("First 10 chars:", process.env.GEMINI_API_KEY?.slice(0, 10));
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "models/gemini-embedding-2" });

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 1000;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function embedTexts(texts) {
  const results = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(text => model.embedContent(text))
    );
    for (const r of batchResults) {
      results.push(r.embedding.values);
    }
    if (i + BATCH_SIZE < texts.length) await sleep(BATCH_DELAY_MS);
  }
  return results;
}

module.exports = { embedTexts };
