const fs = require("fs");
const path = require("path");

const INDEX_PATH = path.join(__dirname, "../bm25_index.json");
let BM25_INDEX = null;

function tokenize(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}

function buildBM25Index(docs) {
  const df = {}, docStats = {};
  let totalLength = 0;
  for (const d of docs) {
    const terms = tokenize(d.content);
    totalLength += terms.length;
    const tf = {};
    terms.forEach(t => { tf[t] = (tf[t] || 0) + 1; });
    docStats[d.id] = { tf, dl: terms.length };
    const seen = new Set();
    for (const t of terms) {
      if (!seen.has(t)) { df[t] = (df[t] || 0) + 1; seen.add(t); }
    }
  }
  return { N: docs.length, avgdl: totalLength / Math.max(1, docs.length), docStats, df };
}

function saveIndex(index) {
  try {
    fs.writeFileSync(INDEX_PATH, JSON.stringify(index));
  } catch (e) {
    console.warn("BM25: failed to persist index:", e.message);
  }
}

function loadIndex() {
  try {
    if (fs.existsSync(INDEX_PATH)) {
      BM25_INDEX = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
      console.log(`BM25: loaded persisted index (${BM25_INDEX.N} docs)`);
    }
  } catch (e) {
    console.warn("BM25: failed to load index:", e.message);
  }
}

function ensureBM25Index(docs) {
  if (!BM25_INDEX || BM25_INDEX.N !== docs.length) {
    BM25_INDEX = buildBM25Index(docs);
    saveIndex(BM25_INDEX);
  }
}

function bm25Score(queryTerms, docId) {
  if (!BM25_INDEX) return 0;
  const { N, avgdl, docStats, df } = BM25_INDEX;
  const k1 = 1.35, b = 0.72;
  const stats = docStats[docId];
  if (!stats) return 0;
  let score = 0;
  for (const term of queryTerms) {
    const f = stats.tf[term] || 0;
    if (!f) continue;
    const n = df[term] || 0;
    const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
    const denom = f + k1 * (1 - b + b * (stats.dl / avgdl));
    score += idf * ((f * (k1 + 1)) / denom);
  }
  return score;
}

loadIndex();

module.exports = { ensureBM25Index, bm25Score };
