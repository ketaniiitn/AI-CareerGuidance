"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { ChatMessages } from "./chat-messages"
import { ChatInput } from "./chat-input"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"

export type Message = {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
}

interface ChatLayoutProps {
  conversationIdProp?: string
}

export default function ChatLayout({ conversationIdProp }: ChatLayoutProps) {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showAllReferences, setShowAllReferences] = useState(false)

  const [conversationId, setConversationId] = useState<string | null>(conversationIdProp || null)

  const [conversationHistoryFetched, setConversationHistoryFetched] = useState(false)
  // ✅ **CHANGED**: Added a new state to specifically track if history is being loaded.
  const [isHistoryLoading, setIsHistoryLoading] = useState(true)
  const [historyId, setHistoryId] = useState<string | null>(null)
  const { user, isLoaded } = useUser()

  const API_BASE = process.env.NEXT_PUBLIC_API_URL

  useEffect(() => {
    // Set initial welcome message only for new chats.
    if (messages.length === 0 && !conversationIdProp) {
      setMessages([
        {
          id: "1",
          content: "Hello! I'm your career guidance assistant. How can I help you today?",
          role: "assistant",
          timestamp: new Date(),
        },
      ])
    }
  }, [conversationIdProp])

  const fetchConversationHistory = async (convId: string) => {
    if (conversationHistoryFetched || !user?.id) return

    // ✅ **CHANGED**: Ensure loading state is true when fetching starts.
    setIsHistoryLoading(true)

    try {
      const res = await fetch(`${API_BASE}/file/conversationHistory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.id, id: convId }),
      })

      if (!res.ok) {
        setMessages([])
        throw new Error("Failed to fetch conversation history")
      }

      const data = await res.json()
      setHistoryId(data.iddd) // Assuming 'iddd' is the correct key from your API response.

      if (data.success && data.data) {
        const history = data.data
        const combinedMessages: Message[] = []
        history.forEach((msg: any) => {
          combinedMessages.push({
            id: msg.id.toString() + "-user",
            content: msg.question,
            role: "user",
            timestamp: new Date(msg.createdAt),
          })
          combinedMessages.push({
            id: msg.id.toString(),
            content: msg.answer + (msg.followUpQuestion || ""),
            role: "assistant",
            timestamp: new Date(msg.createdAt),
          })
        })
        setMessages(combinedMessages)
      }
      setConversationHistoryFetched(true)
    } catch (error) {
      console.error("Error fetching conversation history:", error)
      toast.error("Failed to load conversation history.")
    } finally {
      // ✅ **CHANGED**: Set loading to false when the fetch is complete (whether it succeeds or fails).
      setIsHistoryLoading(false)
    }
  }

  useEffect(() => {
    if (conversationId && !conversationHistoryFetched && isLoaded && user?.id) {
      fetchConversationHistory(conversationId)
    } else if (!conversationId) {
      // ✅ **CHANGED**: If it's a new chat, we're not loading history, so set loading to false.
      setIsHistoryLoading(false)
    }
  }, [conversationId, conversationHistoryFetched, isLoaded, user?.id])

  const handleSendMessage = async (userInput: string) => {
    if (!userInput.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: userInput,
      role: "user",
      timestamp: new Date(),
    }

    const isNewChat = !conversationId
    // For a new chat, replace the initial message. Otherwise, append.
    const messagesToSend = isNewChat ? [userMessage] : [...messages, userMessage]

    setMessages(messagesToSend)
    setIsLoading(true)

    try {
      const res = await fetch(`${API_BASE}/file/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userInput,
          // ✅ **CORRECTED PAYLOAD**: Use `historyId` for follow-ups and `conversationId` as the public ID.
          conversationId: historyId,
          isFollowUp: !isNewChat,
          id: conversationId,
          userId: user?.id,
        }),
      })

      if (!res.ok) {
        throw new Error("Failed to fetch assistant response")
      }

      const data = await res.json()

      if (isNewChat && data.data.conversationId) {
        const newConversationId = data.data.conversationId
        setConversationId(newConversationId)
        router.replace(`/chat/${newConversationId}`)
      }

      const formattedAnswer = formatResponse(data.data.answer ?? "Sorry, I couldn't understand.")
      const formattedReferences = formatReferences(data.data.references ?? [])
      const formattedFollowUp = formatFollowUp(data.data.follow_up ?? "")

      const finalContent = `Here is the answer based on your query:\n\n${formattedAnswer}\n\n---\n\n${formattedReferences}\n\n---\n\n${formattedFollowUp}`

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: finalContent,
        role: "assistant",
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error(error)
      toast.error("Failed to get a response. Please try again.")
      setMessages(messages) // Revert optimistic update on failure.
    } finally {
      setIsLoading(false)
    }
  }

  const formatResponse = (rawAnswer: string): string => rawAnswer.trim()

  const formatReferences = (references: { reference_number: number; preview: string }[]): string => {
    if (!references || references.length === 0) return ""
    const maxReferencesToShow = 3
    const visibleReferences = showAllReferences ? references : references.slice(0, maxReferencesToShow)
    const formattedRefs = visibleReferences.map((ref) => `• Reference ${ref.reference_number}: ${ref.preview.trim()}`)
    const remainingCount = references.length - visibleReferences.length
    let referenceText = `**References**\n${formattedRefs.join("\n")}`
    if (remainingCount > 0 && !showAllReferences) {
      referenceText += `\n\nClick "See More" below to view ${remainingCount} more reference${remainingCount > 1 ? "s" : ""}.`
    }
    return referenceText
  }

  const formatFollowUp = (followup: string): string => {
    if (!followup || followup.trim() === "") return ""
    return `\n\n**Suggested Follow-up Question**\n• ${followup.trim()}`
  }

  const handleSeeMoreClick = () => {
    setShowAllReferences(true)
  }

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      <ChatMessages messages={messages} isLoading={isLoading || isHistoryLoading} />
      <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading || isHistoryLoading} />

      {!showAllReferences && messages.some((m) => m.content.includes('Click "See More"')) && (
        <div className="text-center mt-4">
          <button onClick={handleSeeMoreClick} className="text-blue-500">
            See More
          </button>
        </div>
      )}
    </div>
  )
}
