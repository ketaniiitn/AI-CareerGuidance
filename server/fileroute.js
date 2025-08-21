const express = require("express");
const router = express.Router();
const { createEmbeddingFromPDF, query, fetchConversationHistory,fetchAllConversationsh,conversationHistory,createConversation } = require("./fileController");

router.get("/pdf", createEmbeddingFromPDF);
router.post("/query", query);
router.post("/history", fetchConversationHistory);
router.post("/conversationsh", fetchAllConversationsh);
router.post("/conversationHistory", conversationHistory);
router.post("/createConversation", createConversation);

module.exports = router;
