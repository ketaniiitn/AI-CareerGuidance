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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "https://ai-careerguidance.onrender.com"

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
  const initializedRef = useRef(false)
  const initialTimeRef = useRef(new Date())

  useEffect(() => {
    if (!initializedRef.current && !conversationIdProp) {
      initializedRef.current = true
      setMessages([{
        id: "welcome",
        content: "Hello! I'm your career guidance assistant. How can I help you today?",
        role: "assistant",
        timestamp: initialTimeRef.current,
      }])
    }
  }, [conversationIdProp])

  const fetchConversationHistory = useCallback(async (convId: string) => {
    if (conversationHistoryFetched || !user?.id) return
    setIsHistoryLoading(true)
    try {
      const res = await fetch(`${API_BASE}/file/conversationHistory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.id, id: convId }),
      })
      if (!res.ok) throw new Error("Failed to fetch conversation history")
      const data = await res.json()
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
  }, [conversationHistoryFetched, user?.id])

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
    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    const assistantId = (Date.now() + 1).toString()
    // Add empty assistant bubble immediately so the user sees streaming tokens
    setMessages(prev => [...prev, { id: assistantId, content: "", role: "assistant", timestamp: new Date() }])

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

      if (!res.ok || !res.body) throw new Error("Failed to fetch assistant response")

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let streamedAnswer = ""
      let donePayload: { conversationId?: string; follow_up?: string; references?: { reference_number: number; source?: string; score?: number }[] } | null = null

      outer: while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === "token") {
              streamedAnswer += event.content
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: streamedAnswer } : m))
            } else if (event.type === "done") {
              donePayload = event
              break outer
            } else if (event.type === "error") {
              throw new Error(event.message)
            }
          } catch (parseErr) {
            // Only re-throw non-JSON-parse errors (e.g. the error event throw)
            if (!(parseErr instanceof SyntaxError)) throw parseErr
          }
        }
      }

      // Append references + follow-up to the final message, then navigate
      if (donePayload) {
        const formattedReferences = formatReferences(donePayload.references ?? [])
        const formattedFollowUp = formatFollowUp(donePayload.follow_up ?? "")
        const suffix = [formattedReferences, formattedFollowUp].filter(Boolean).join("\n\n---\n\n")
        const finalContent = suffix
          ? `Here is the answer based on your query:\n\n${streamedAnswer}\n\n---\n\n${suffix}`
          : streamedAnswer
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: finalContent } : m))
        if (isNewChat && donePayload.conversationId) {
          setConversationId(donePayload.conversationId)
          router.replace(`/chat/${donePayload.conversationId}`)
        }
      }
    } catch (e) {
      console.error(e)
      toast.error("Failed to get a response. Please try again.")
      setMessages(prev => prev.filter(m => m.id !== userMessage.id && m.id !== assistantId))
    } finally {
      setIsLoading(false)
    }
  }

  const formatReferences = (refs: { reference_number: number; source?: string; score?: number }[]) => {
    if (!refs?.length) return ""
    const seen = new Set<string>()
    const unique = refs.filter(r => { const s = (r.source || "unknown").trim(); if (seen.has(s)) return false; seen.add(s); return true; })
    const visible = showAllReferences ? unique : unique.slice(0, 3)
    const remaining = unique.length - visible.length
    let text = `**Sources**\n${visible.map(r => `• ${r.source || "unknown"}`).join("\n")}`
    if (remaining > 0 && !showAllReferences) text += `\n\nClick "See More" below to view ${remaining} more source${remaining > 1 ? "s" : ""}.`
    return text
  }

  const formatFollowUp = (f: string) =>
    f?.trim() ? `**Suggested Follow-up Question**\n• ${f.trim()}` : ""

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      <ChatMessages messages={messages} isLoading={isLoading || isHistoryLoading} />
      <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading || isHistoryLoading} />
      {!showAllReferences && messages.some(m => m.content.includes('Click "See More"')) && (
        <div className="text-center mt-4">
          <button onClick={() => setShowAllReferences(true)} className="text-blue-500">See More</button>
        </div>
      )}
    </div>
  )
}
