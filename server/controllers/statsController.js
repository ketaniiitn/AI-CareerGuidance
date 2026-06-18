const prisma = require("../config/db");

const fetchStats = async (req, res) => {
  try {
    const docs = await prisma.document.findMany({ select: { id: true, sourceFile: true, stream: true } });
    const bySource = {}, byStream = {};
    docs.forEach(d => {
      bySource[d.sourceFile] = (bySource[d.sourceFile] || 0) + 1;
      byStream[d.stream || "__null__"] = (byStream[d.stream || "__null__"] || 0) + 1;
    });
    res.json({ total: docs.length, sources: bySource, streams: byStream });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
};

module.exports = { fetchStats };
