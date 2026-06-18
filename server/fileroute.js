const express = require("express");
const router = express.Router();

const { createEmbeddingFromPDF } = require("./controllers/embeddingController");
const { query } = require("./controllers/queryController");
const { fetchConversationHistory, fetchAllConversations, conversationHistory, createConversation } = require("./controllers/conversationController");
const { fetchStats } = require("./controllers/statsController");

router.get("/pdf", createEmbeddingFromPDF);
router.get("/stats", fetchStats);
router.post("/query", query);
router.get("/history/:conversationId", fetchConversationHistory);
router.post("/conversationsh", fetchAllConversations);
router.post("/conversationHistory", conversationHistory);
router.post("/createConversation", createConversation);

module.exports = router;
