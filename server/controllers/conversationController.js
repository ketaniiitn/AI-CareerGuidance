const prisma = require("../config/db");

// GET /file/history/:conversationId  (legacy param-based route)
const fetchConversationHistory = async (req, res) => {
  const { conversationId } = req.params;
  if (!conversationId) return res.status(400).json({ success: false, message: "Conversation ID is required" });

  try {
    const history = await prisma.conversationHistory.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
    });
    if (!history.length) return res.status(404).json({ success: false, message: "No history found" });

    res.json({ success: true, id: history[0].id, conver: conversationId, latestMessage: history[0], history });
  } catch (error) {
    console.error("fetchConversationHistory error:", error);
    res.status(500).json({ error: "Error fetching conversation history" });
  }
};

// POST /file/conversationsh  — list all conversation IDs for a user
const fetchAllConversations = async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ success: false, message: "User ID is required." });

  try {
    const conversations = await prisma.conversation.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
    });
    if (!conversations.length) return res.json({ success: false, message: "No conversations found" });

    res.json({ success: true, data: conversations.map(c => c.id) });
  } catch (error) {
    console.error("fetchAllConversations error:", error);
    res.status(500).json({ error: "Error fetching conversations" });
  }
};

// POST /file/conversationHistory  — fetch history by conversation ID, verified against uid
const conversationHistory = async (req, res) => {
  const { id, uid } = req.body;
  if (!id) return res.status(400).json({ success: false, error: "Conversation ID is required" });

  try {
    // Security: verify the requesting user owns this conversation
    if (uid) {
      const conversation = await prisma.conversation.findUnique({ where: { id } });
      if (conversation && conversation.userId !== uid) {
        return res.status(403).json({ success: false, error: "Access denied" });
      }
    }

    const history = await prisma.conversationHistory.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "asc" },
    });

    if (!history.length) return res.json({ success: false, error: "No history found for this conversation" });

    res.json({ success: true, data: history });
  } catch (error) {
    console.error("conversationHistory error:", error);
    res.status(500).json({ error: "Error fetching conversation history" });
  }
};

// POST /file/createConversation
const createConversation = async (req, res) => {
  const { id, uid } = req.body;
  if (!id || !uid) return res.status(400).json({ success: false, error: "Conversation ID and User ID are required." });

  try {
    const newConversation = await prisma.conversation.create({ data: { id, userId: uid } });
    res.status(201).json({ success: true, data: newConversation });
  } catch (error) {
    console.error("createConversation error:", error);
    res.status(500).json({ error: "Error creating conversation" });
  }
};

module.exports = { fetchConversationHistory, fetchAllConversations, conversationHistory, createConversation };
