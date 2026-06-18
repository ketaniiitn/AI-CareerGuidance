const PROFILE_KEYWORDS = {
  analytical: ["data", "analysis", "research", "finance", "statistics", "logic"],
  people: ["team", "leadership", "helping", "counseling", "community", "client"],
  creative: ["design", "creative", "writing", "art", "media", "fashion", "content"],
  operational: ["process", "management", "operations", "logistics", "plan", "organize"],
};

const PROFILE_BOOST_KEYWORDS = {
  analytical: ["analysis", "data", "quantitative", "research", "statistics", "finance"],
  people: ["team", "collaborative", "counsel", "community", "client", "communication", "leadership"],
  creative: ["design", "creative", "innovation", "media", "art", "fashion", "content", "ux", "ui"],
  operational: ["process", "operations", "logistics", "supply", "manage", "planning"],
};

function inferProfileSignals(question, historyTexts = []) {
  const text = ([...historyTexts, question]).join(" ").toLowerCase();
  const signals = { analytical: 0, people: 0, creative: 0, operational: 0 };
  for (const [type, words] of Object.entries(PROFILE_KEYWORDS)) {
    words.forEach(w => { if (text.includes(w)) signals[type]++; });
  }
  const [top] = Object.entries(signals).sort((a, b) => b[1] - a[1]);
  return { profileType: top && top[1] > 0 ? top[0] : null, signals };
}

function computeProfileBoost(doc, profileType) {
  if (!profileType) return 0;
  const content = doc.content.toLowerCase();
  const kws = PROFILE_BOOST_KEYWORDS[profileType] || [];
  const hits = kws.filter(k => content.includes(k)).length;
  return Math.min(0.12, hits * 0.02);
}

module.exports = { inferProfileSignals, computeProfileBoost };
