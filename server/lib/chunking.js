function detectSectionTitles(rawText) {
  const titles = new Set();
  rawText.split(/\n+/).forEach(l => {
    const t = l.trim();
    if (t && /^[A-Z][A-Z\s/&-]{3,}$/.test(t) && t.length < 80) titles.add(t);
  });
  return titles;
}

function advancedChunk(rawText, opts = {}) {
  const { maxTokens = 380, overlapTokens = 40, minChunkChars = 180 } = opts;
  const clean = rawText.replace(/\r/g, "").replace(/\t/g, " ").replace(/ +/g, " ");
  const blocks = clean.split(/\n{2,}/).map(b => b.trim()).filter(Boolean);
  const titles = detectSectionTitles(rawText);
  const chunks = [];
  let buffer = [], tokenEstimate = 0;

  const flush = () => {
    if (!buffer.length) return;
    const text = buffer.join("\n").trim();
    if (text.length < minChunkChars) { buffer = []; tokenEstimate = 0; return; }
    chunks.push(text);
    const words = text.split(/\s+/);
    buffer = words.slice(Math.max(0, words.length - overlapTokens));
    tokenEstimate = buffer.length;
  };

  for (const block of blocks) {
    const words = block.split(/\s+/);
    if (titles.has(block.trim()) && buffer.length) { flush(); buffer = [block]; tokenEstimate = words.length; continue; }
    if (tokenEstimate + words.length > maxTokens) flush();
    buffer.push(block);
    tokenEstimate += words.length;
  }
  flush();
  return chunks;
}

function extractKeywords(text, k = 8) {
  const stop = new Set(["the","and","is","to","of","in","a","for","on","with","by","or","be","as","at","from","an","are","that","this","it","into","about","can","will","their"]);
  const freq = {};
  text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean).forEach(w => {
    if (!stop.has(w) && w.length > 2) freq[w] = (freq[w] || 0) + 1;
  });
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, k).map(e => e[0]).join(",");
}

function extractProbableTitle(chunk) {
  const firstLine = chunk.split(/\n/)[0].trim();
  if (/^[A-Z][A-Z\s/&-]{3,}$/.test(firstLine) && firstLine.length < 80) return firstLine;
  return firstLine.split(/\s+/).slice(0, 6).join(" ");
}

module.exports = { advancedChunk, extractKeywords, extractProbableTitle };
