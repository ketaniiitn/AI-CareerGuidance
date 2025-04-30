"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ChatMessages } from "./chat-messages";
import { ChatInput } from "./chat-input";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";

export type Message = {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
};

const initialMessages: Message[] = [
  {
    id: "1",
    content: "Hello! I'm your career guidance assistant. How can I help you today?",
    role: "assistant",
    timestamp: new Date(),
  },
];

export default function ChatLayout() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [showAllReferences, setShowAllReferences] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(
    usePathname().split("/").pop() || null
  );
  const [conversationHistoryFetched, setConversationHistoryFetched] = useState(false);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const { user, isLoaded } = useUser();

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "https://ai-careerguidance.onrender.com";

  const fetchConversationHistory = async (conversationId: string) => {
    if (conversationHistoryFetched || !user?.id) return;

    try {
      const res = await fetch(`${API_BASE}/file/conversationHistory`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uid: user.id, id: conversationId }),
      });

      if (!res.ok) {
        setMessages([]);
        throw new Error("Failed to fetch conversation history");
      }

      const data = await res.json();
      setHistoryId(data.iddd);

      if (data.success && data.data) {
        const history = data.data;

        const formattedHistory: Message[] = history.map((msg: any) => ({
          id: msg.id.toString(),
          content: msg.answer + msg.followUpQuestion,
          role: "assistant",
          timestamp: new Date(msg.createdAt),
        }));

        const userMessages: Message[] = history.map((msg: any) => ({
          id: msg.id.toString() + "-user",
          content: msg.question,
          role: "user",
          timestamp: new Date(msg.createdAt),
        }));

        const combinedMessages = [];
        for (let i = 0; i < history.length; i++) {
          combinedMessages.push(userMessages[i]);
          combinedMessages.push(formattedHistory[i]);
        }

        setMessages(combinedMessages);
      }

      setConversationHistoryFetched(true);
    } catch (error) {
      console.error("Error fetching conversation history:", error);
      toast.error("Failed to load conversation history.");
    }
  };

  useEffect(() => {
    if (conversationId && !conversationHistoryFetched && isLoaded && user?.id) {
      fetchConversationHistory(conversationId);
    }
  }, [conversationId, conversationHistoryFetched, isLoaded, user?.id]);

  const formatResponse = (rawAnswer: string): string => rawAnswer.trim();

  const formatReferences = (
    references: { reference_number: number; preview: string }[]
  ): string => {
    if (!references || references.length === 0) return "";

    const maxReferencesToShow = 3;
    const visibleReferences = showAllReferences
      ? references
      : references.slice(0, maxReferencesToShow);

    const formattedRefs = visibleReferences.map(
      (ref) => `• Reference ${ref.reference_number}: ${ref.preview.trim()}`
    );
    const remainingCount = references.length - visibleReferences.length;

    let referenceText = `**References**\n${formattedRefs.join("\n")}`;
    if (remainingCount > 0 && !showAllReferences) {
      referenceText += `\n\nClick "See More" below to view ${remainingCount} more reference${remainingCount > 1 ? "s" : ""}.`;
    }

    return referenceText;
  };

  const formatFollowUp = (followup: string): string => {
    if (!followup || followup.trim() === "") return "";
    return `\n\n**Suggested Follow-up Question**\n• ${followup.trim()}`;
  };

  const handleSeeMoreClick = () => {
    setShowAllReferences(true);
  };

  const handleSendMessage = async (userInput: string) => {
    if (!userInput.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: userInput,
      role: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/file/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: userInput,
          conversationId: historyId,
          isFollowUp: true,
          id: conversationId,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to fetch assistant response");
      }

      const data = await res.json();
      const formattedAnswer = formatResponse(data.data.answer ?? "Sorry, I couldn't understand.");
      const formattedReferences = formatReferences(data.data.references ?? []);
      const formattedFollowUp = formatFollowUp(data.data.follow_up ?? "");

      const finalContent = `Here is the answer based on your query:\n\n${formattedAnswer}\n\n---\n\n${formattedReferences}\n\n---\n\n${formattedFollowUp}`;

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: finalContent,
        role: "assistant",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error(error);
      toast.error("Failed to get a response. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      <ChatMessages messages={messages} isLoading={isLoading} />
      <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />

      {/* See More Button */}
      {!showAllReferences && messages.some((m) => m.content.includes("Click \"See More\"")) && (
        <div className="text-center mt-4">
          <button onClick={handleSeeMoreClick} className="text-blue-500">See More</button>
        </div>
      )}
    </div>
  );
}
