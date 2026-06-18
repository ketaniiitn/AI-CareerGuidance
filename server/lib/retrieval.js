const { ensureBM25Index, bm25Score } = require("./bm25");
const { computeProfileBoost } = require("./profileInference");
const { DOMAIN_CONFIG } = require("./domainConfig");

const l2Norm = (vec) => Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
const bytesToVector = (bytes) => Array.from(new Float32Array(bytes));

function cosineSimilarity(vecA, vecB, normB) {
  const dot = vecA.reduce((s, a, i) => s + a * vecB[i], 0);
  return dot / (l2Norm(vecA) * normB);
}

function hybridRetrieve({ documents, queryEmbedding, retrievalQuestion, domainTerm, profileType }) {
  ensureBM25Index(documents);
  const queryTerms = new Set(retrievalQuestion.toLowerCase().split(/\W+/).filter(w => w.length > 2));

  const scored = documents.map(doc => {
    const emb = bytesToVector(doc.embedding);
    const embNorm = doc.embeddingNorm || l2Norm(emb);
    const cos = cosineSimilarity(queryEmbedding, emb, embNorm);
    const kw = (doc.keywords || "").split(",").filter(Boolean);
    const lexicalMatches = kw.filter(k => queryTerms.has(k)).length;
    const bm25 = bm25Score([...queryTerms], doc.id);
    const profileBoost = computeProfileBoost(doc, profileType);
    let domainBoost = 0;
    if (domainTerm) {
      const cfg = DOMAIN_CONFIG[domainTerm];
      const lc = doc.content.toLowerCase();
      if (cfg.streamKeys.includes(doc.stream)) domainBoost += 0.35;
      if (cfg.keywords.some(k => lc.includes(k))) domainBoost += 0.20;
      domainBoost = Math.min(domainBoost, 0.45);
    }
    return { ...doc, _emb: emb, cos, lexicalMatches, bm25, profileBoost, domainBoost };
  });

  const maxCos = Math.max(...scored.map(p => p.cos), 1e-6);
  const maxBM = Math.max(...scored.map(p => p.bm25), 1e-6);

  const fused = scored
    .map(p => ({
      ...p,
      fused: (p.cos / maxCos) * 0.50 + (p.bm25 / maxBM) * 0.27 + p.lexicalMatches * 0.05 + p.profileBoost + p.domainBoost
    }))
    .sort((a, b) => b.fused - a.fused)
    .slice(0, 40);

  // Deduplicate near-identical chunks
  const deduped = [];
  for (const cand of fused) {
    const isDup = deduped.some(ex => cosineSimilarity(cand._emb, ex._emb, l2Norm(ex._emb)) > 0.92);
    if (!isDup) deduped.push(cand);
  }

  const reranked = deduped
    .map(d => ({ ...d, rerank: d.fused * (1 + d.lexicalMatches * 0.05) - Math.max(0, (d.tokenCount - 420)) / 1400 }))
    .sort((a, b) => b.rerank - a.rerank)
    .slice(0, 12);

  // Enforce source diversity (max 2 chunks per file)
  const perFileCount = {};
  const diversified = [];
  for (const d of reranked) {
    const key = d.sourceFile || "unknown";
    perFileCount[key] = (perFileCount[key] || 0) + 1;
    if (perFileCount[key] <= 2) diversified.push(d);
    if (diversified.length >= 10) break;
  }

  // Domain fallback: ensure at least 3 domain-relevant chunks
  if (domainTerm) {
    const cfg = DOMAIN_CONFIG[domainTerm];
    const isDomainChunk = d => d.domainBoost > 0.1 || cfg.streamKeys.includes(d.stream);
    if (diversified.filter(isDomainChunk).length < 3) {
      for (const add of reranked.filter(d => !diversified.includes(d) && isDomainChunk(d))) {
        diversified.push(add);
        if (diversified.filter(isDomainChunk).length >= 3) break;
      }
    }
  }

  return diversified.slice(0, 8);
}

module.exports = { hybridRetrieve, l2Norm, bytesToVector };
