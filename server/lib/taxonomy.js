const STREAM_MAP = [
  { key: "commerce", words: ["b.com", "account", "finance", "marketing", "business", "commerce", "economics"] },
  { key: "law", words: ["llb", "legal", "law", "advocate", "juris"] },
  { key: "engineering", words: ["engineering", "b.tech", "mechanical", "civil", "electrical", "computer science"] },
  { key: "medical", words: ["mbbs", "medical", "doctor", "medicine", "clinical", "hospital"] },
  { key: "hospitality", words: ["hotel management", "hospitality", "bhm"] },
  { key: "arts_humanities", words: ["history", "philosophy", "sociology", "psychology", "humanities", "liberal arts"] },
  { key: "design", words: ["design", "nift", "fashion", "creative", "ux", "ui"] },
  { key: "media", words: ["mass communication", "journalism", "media", "broadcast"] },
  { key: "science", words: ["physics", "chemistry", "biology", "mathematics", "pure science"] }
];

const EXAM_PATTERNS = [/neet/i, /jee/i, /clat/i, /gate/i, /cat /i, /nda /i, /ssc/i, /upsc/i, /nchm/i];
const DEGREE_PATTERNS = [/b\.com/i, /bba/i, /mba/i, /bsc/i, /b\.tech/i, /llb/i, /mbbs/i, /bhm/i];
const SKILL_WORDS = ["communication", "analysis", "problem-solving", "leadership", "teamwork", "creativity", "time management", "financial", "research"];

function deriveTaxonomy(text) {
  const lower = text.toLowerCase();
  let stream = null;
  for (const s of STREAM_MAP) {
    if (s.words.some(w => lower.includes(w))) { stream = s.key; break; }
  }
  const exams = [...new Set(EXAM_PATTERNS.map(r => { const m = text.match(r); return m ? m[0].toUpperCase() : null; }).filter(Boolean))];
  const degrees = [...new Set(DEGREE_PATTERNS.map(r => { const m = text.match(r); return m ? m[0].toUpperCase() : null; }).filter(Boolean))];
  const skills = SKILL_WORDS.filter(sw => lower.includes(sw));
  return { stream, exams, degrees, skills };
}

module.exports = { deriveTaxonomy };
