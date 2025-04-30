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
  const [showAllReferences, setShowAllReferences] = useState(false); // State to manage "See More" click
  const [conversationId, setConversationId] = useState<string | null>(
    usePathname().split("/").pop() || null
  ); // Track conversation ID
  const [conversationHistoryFetched, setConversationHistoryFetched] = useState(false); // To prevent refetching history
  // Function to fetch conversation history only once
  const [historyId, setHistoryId] = useState<string | null>(null); // Track history ID
  const { user, isLoaded, isSignedIn } = useUser();
  console.log(user)
  const fetchConversationHistory = async (conversationId: string) => {
    if (conversationHistoryFetched) return; // Don't fetch again if history is already fetched

    try {
      const res = await fetch("https://ai-careerguidance.onrender.com/file/conversationHistory", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uid: user?.id ,id: conversationId }),
      });
      if (!res.ok) {
        setMessages([]); // Clear messages on error
        throw new Error("Failed to fetch conversation history");
      }

      const data = await res.json();
      setHistoryId(data.iddd);
      if (data.success && data.data) {
        const history = data.data;
         setMessages([]); // Clear messages before setting new ones
        const formattedHistory: Message[] = history.map((msg: any) => ({
          id: msg.id.toString(),
          content: msg.answer+msg.followUpQuestion, // Display the assistant's answer
          role: "assistant", // This message is from the assistant
          timestamp: new Date(msg.createdAt),
        }));

        // Add the user's question as a "user" message
        const userMessages: Message[] = history.map((msg: any) => ({
          id: msg.id.toString() + "-user",
          content: msg.question, // Display the user's question
          role: "user", // This message is from the user
          timestamp: new Date(msg.createdAt),
        }));

        // Combine the user questions and assistant answers
        const combinedMessages = [];
        for (let i = 0; i < history.length; i++) {
          combinedMessages.push(userMessages[i]);
          combinedMessages.push(formattedHistory[i]);
        }

        setMessages(combinedMessages);
      }
      setConversationHistoryFetched(true); // Mark history as fetched
    } catch (error) {
      console.error("Error fetching conversation history:", error);
      toast.error("Failed to load conversation history.");
    }
  };

  useEffect(() => {
    if (conversationId && !conversationHistoryFetched) {
      fetchConversationHistory(conversationId); // Fetch history only once
    }
  }, [conversationId, conversationHistoryFetched]);

  const formatResponse = (rawAnswer: string): string => {
    return rawAnswer.trim(); // Answer is just displayed as it is
  };

  const formatReferences = (references: { reference_number: number, preview: string }[]): string => {
    if (!references || references.length === 0) {
      return '';
    }

    const maxReferencesToShow = 3; // Number of references to show initially
    const visibleReferences = showAllReferences ? references : references.slice(0, maxReferencesToShow);

    const formattedRefs = visibleReferences.map(ref => `• Reference ${ref.reference_number}: ${ref.preview.trim()}`);
    const remainingCount = references.length - visibleReferences.length;

    const referenceText = `**References**\n${formattedRefs.join('\n')}`;

    // If there are more references to show, append a "See More" indicator
    if (remainingCount > 0 && !showAllReferences) {
      return `${referenceText}\n\nSee More ${remainingCount} reference${remainingCount > 1 ? 's' : ''}...`;
    }

    return referenceText;
  };

  // Handle clicking on "See More"
  const handleSeeMoreClick = () => {
    setShowAllReferences(true);
  };

  const formatFollowUp = (followup: string): string => {
    if (!followup || followup.trim() === '') {
      return '';
    }
    return `\n\n**Suggested Follow-up Question**\n• ${followup.trim()}`;
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
      const res = await fetch("https://ai-careerguidance.onrender.com/file/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: userInput, conversationId: historyId, isFollowUp: true,id: conversationId }),
      });

      if (!res.ok) {
        throw new Error("Failed to fetch assistant response");
      }

      const data = await res.json();

      const formattedAnswer = formatResponse(data.data.answer ?? "Sorry, I couldn't understand.");
      const formattedReferences = formatReferences(data.data.references ?? []);
      const formattedFollowUp = formatFollowUp(data.data.follow_up ?? '');

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

      {/* Add button for "See More" */}
      {showAllReferences && (
        <div className="text-center mt-4">
          <button onClick={handleSeeMoreClick} className="text-blue-500">See More</button>
        </div>
      )}
    </div>
  );
}
