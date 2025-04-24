"use client"

import { useState } from "react"
import { toast } from "sonner" // ✅ use sonner directly now
import { ChatMessages } from "./chat-messages"
import { ChatInput } from "./chat-input"

// Message type definition
export type Message = {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
}

// Sample initial messages
const initialMessages: Message[] = [
  {
    id: "1",
    content: "Hello! I'm your career guidance assistant. How can I help you today?",
    role: "assistant",
    timestamp: new Date(),
  },
]

export default function ChatLayout() {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [isLoading, setIsLoading] = useState(false)

  const handleSendMessage = async (message: string) => {
    if (!message.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: message,
      role: "user",
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500))

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content:
          "This is a simulated response. In a real implementation, this would be replaced with an actual API call to your AI service.",
        role: "assistant",
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      toast.error("Failed to send message. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      <ChatMessages messages={messages} isLoading={isLoading} />
      <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
    </div>
  )
}
