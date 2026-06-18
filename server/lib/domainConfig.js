const DOMAIN_CONFIG = {
  engineering: {
    streamKeys: ["engineering"],
    keywords: ["engineering", "b.tech", "btech", "mechanical", "civil", "electrical", "computer science", "software", "it"],
    expansions: ["jee", "jee main", "jee advanced", "bitsat", "viteee", "srmjeee", "comedk", "mht cet", "wbjee", "keam", "engineering colleges", "entrance exam", "b.tech", "engineering degree"]
  },
  commerce: { streamKeys: ["commerce"], keywords: ["commerce", "b.com", "account", "finance", "marketing"], expansions: [] },
  law: { streamKeys: ["law"], keywords: ["law", "llb", "legal", "clat"], expansions: [] },
  medical: { streamKeys: ["medical"], keywords: ["medical", "mbbs", "doctor", "neet"], expansions: [] },
  humanities: { streamKeys: ["arts_humanities"], keywords: ["humanities", "arts", "philosophy", "psychology", "sociology"], expansions: [] }
};

const DOMAIN_KEYWORDS = ["commerce", "engineering", "law", "medical", "hotel", "hospitality", "arts", "humanities", "science", "management", "design", "mass communication", "economics", "social work", "data", "it"];

function detectDomainTerm(questionLower) {
  for (const [domain, cfg] of Object.entries(DOMAIN_CONFIG)) {
    if (cfg.keywords.some(k => questionLower.includes(k))) return domain;
  }
  return null;
}

module.exports = { DOMAIN_CONFIG, DOMAIN_KEYWORDS, detectDomainTerm };
