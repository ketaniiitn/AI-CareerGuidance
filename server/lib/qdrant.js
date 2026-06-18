require("dotenv").config();
const { QdrantClient } = require("@qdrant/js-client-rest");

const COLLECTION_NAME = "career_docs";
const VECTOR_SIZE = 3072; // gemini-embedding-2 dimension

let client = null;

function getClient() {
  if (!process.env.QDRANT_URL) return null;
  if (!client) {
    client = new QdrantClient({
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
    });
  }
  return client;
}

async function ensureCollection() {
  const c = getClient();
  if (!c) return false;
  try {
    const { collections } = await c.getCollections();
    if (!collections.some(col => col.name === COLLECTION_NAME)) {
      await c.createCollection(COLLECTION_NAME, {
        vectors: { size: VECTOR_SIZE, distance: "Cosine" },
      });
      console.log(`Qdrant: created collection "${COLLECTION_NAME}"`);
    } else {
      console.log(`Qdrant: collection "${COLLECTION_NAME}" already exists`);
    }
    return true;
  } catch (e) {
    console.error("Qdrant: ensureCollection failed:", e.message);
    return false;
  }
}

async function clearCollection() {
  const c = getClient();
  if (!c) return;
  try {
    await c.deleteCollection(COLLECTION_NAME);
    await ensureCollection();
  } catch (e) {
    console.warn("Qdrant: clearCollection failed:", e.message);
  }
}

async function upsertVectors(points) {
  const c = getClient();
  if (!c) return;
  try {
    const result = await c.upsert(COLLECTION_NAME, { wait: true, points });
    console.log(`Qdrant: upserted ${points.length} vectors, status: ${result.status}`);
  } catch (e) {
    console.error("Qdrant: upsert failed:", e.message, e?.data || "");
  }
}

// Returns array of { id, score } sorted by score desc, or null if Qdrant unavailable
async function searchVectors(queryVector, topK = 40) {
  const c = getClient();
  if (!c) return null;
  try {
    return await c.search(COLLECTION_NAME, {
      vector: queryVector,
      limit: topK,
      with_payload: false,
    });
  } catch (e) {
    console.warn("Qdrant: search failed:", e.message);
    return null;
  }
}

module.exports = { ensureCollection, clearCollection, upsertVectors, searchVectors };
