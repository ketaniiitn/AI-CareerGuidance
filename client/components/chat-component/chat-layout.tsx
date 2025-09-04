"use client"

import { useState, useEffect, useRef, useCallback } from "react"
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
  const { user, isLoaded } = useUser()
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showAllReferences, setShowAllReferences] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(conversationIdProp || null)
  const [conversationHistoryFetched, setConversationHistoryFetched] = useState(false)
  const [isHistoryLoading, setIsHistoryLoading] = useState(true)
  const [historyId, setHistoryId] = useState<string | null>(null)

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000"
  const initializedRef = useRef(false)

  // Stable initial timestamp to avoid SSR/CSR drift
  const initialTimeRef = useRef(new Date())

  useEffect(() => {
    if (!initializedRef.current && !conversationIdProp) {
      initializedRef.current = true
      setMessages([
        {
          id: "welcome",
          content: "Hello! I'm your career guidance assistant. How can I help you today?",
          role: "assistant",
          timestamp: initialTimeRef.current,
        },
      ])
    }
  }, [conversationIdProp])

  const fetchConversationHistory = useCallback(async (convId: string) => {
    if (conversationHistoryFetched || !user?.id) return
    setIsHistoryLoading(true)
    interface ConversationHistoryRow { id: string | number; question: string; answer: string; followUpQuestion?: string; createdAt: string }
    interface HistoryResponse { success: boolean; data?: ConversationHistoryRow[]; iddd?: string }
    try {
      const res = await fetch(`${API_BASE}/file/conversationHistory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.id, id: convId }),
      })
      if (!res.ok) throw new Error("Failed to fetch conversation history")
      const data: HistoryResponse = await res.json()
      setHistoryId(data.iddd ?? null)
      if (data.success && Array.isArray(data.data)) {
        const combined: Message[] = []
        for (const msg of data.data) {
          combined.push({ id: `${msg.id}-user`, content: msg.question, role: "user", timestamp: new Date(msg.createdAt) })
          combined.push({ id: String(msg.id), content: msg.answer + (msg.followUpQuestion || ""), role: "assistant", timestamp: new Date(msg.createdAt) })
        }
        setMessages(combined)
      }
      setConversationHistoryFetched(true)
    } catch (e) {
      console.error("Error fetching conversation history:", e)
      toast.error("Failed to load conversation history.")
    } finally {
      setIsHistoryLoading(false)
    }
  }, [API_BASE, conversationHistoryFetched, user?.id])

  useEffect(() => {
    if (conversationId && !conversationHistoryFetched && isLoaded && user?.id) {
      fetchConversationHistory(conversationId)
    } else if (!conversationId) {
      setIsHistoryLoading(false)
    }
  }, [conversationId, conversationHistoryFetched, isLoaded, user?.id, fetchConversationHistory])

  const handleSendMessage = async (userInput: string) => {
    if (!userInput.trim()) return
    const userMessage: Message = {
      id: Date.now().toString(),
      content: userInput,
      role: "user",
      timestamp: new Date(),
    }
    const isNewChat = !conversationId
    const messagesToSend = isNewChat ? [...messages, userMessage] : [...messages, userMessage]
    setMessages(messagesToSend)
    setIsLoading(true)
    try {
      const res = await fetch(`${API_BASE}/file/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userInput,
          conversationId: historyId,
          isFollowUp: !isNewChat,
          id: conversationId,
          userId: user?.id,
          debug: false,
        }),
      })
      if (!res.ok) throw new Error("Failed to fetch assistant response")
      const data = await res.json()
      if (isNewChat && data.data.conversationId) {
        const newId = data.data.conversationId
        setConversationId(newId)
        router.replace(`/chat/${newId}`)
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
      setMessages(prev => [...prev, assistantMessage])
    } catch (e) {
      console.error(e)
      toast.error("Failed to get a response. Please try again.")
      setMessages(prev => prev.filter(m => m.id !== userMessage.id))
    } finally {
      setIsLoading(false)
    }
  }

  const formatResponse = (raw: string) => raw.trim()
  const formatReferences = (refs: { reference_number: number; source?: string; score?: number }[]) => {
    if (!refs || refs.length === 0) return ""
    const seen = new Set<string>()
    const unique = refs.filter(r => {
      const src = (r.source || 'unknown').trim();
      if (seen.has(src)) return false; seen.add(src); return true;
    })
    const maxToShow = 3
    const visible = showAllReferences ? unique : unique.slice(0, maxToShow)
    const formatted = visible.map(r => `• ${r.source || 'unknown'}`)
    const remaining = unique.length - visible.length
    let text = `**Sources**\n${formatted.join('\n')}`
    if (remaining > 0 && !showAllReferences) text += `\n\nClick "See More" below to view ${remaining} more source${remaining>1?'s':''}.`
    return text
  }
  const formatFollowUp = (f: string) => f && f.trim() !== "" ? `\n\n**Suggested Follow-up Question**\n• ${f.trim()}` : ""
  const handleSeeMoreClick = () => setShowAllReferences(true)

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      <ChatMessages messages={messages} isLoading={isLoading || isHistoryLoading} />
      <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading || isHistoryLoading} />
      {!showAllReferences && messages.some(m => m.content.includes('Click "See More"')) && (
        <div className="text-center mt-4">
          <button onClick={handleSeeMoreClick} className="text-blue-500">See More</button>
        </div>
      )}
    </div>
  )
}