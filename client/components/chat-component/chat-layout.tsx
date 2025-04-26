"use client"

import { useState } from "react"
import { toast } from "sonner"
import { ChatMessages } from "./chat-messages"
import { ChatInput } from "./chat-input"

export type Message = {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
}

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

  // Function to format the raw API response with varied formatting
  const formatResponse = (rawAnswer: string): string => {
    const lines = rawAnswer.split('\n').filter(line => line.trim() !== '')

    const formattedLines = lines.map((line, index) => {
      // Format headings for lines containing "Option"
      if (line.includes('Option')) {
        return `### ${line.trim()}`
      }
      // Numbered list for sequential items
      else if (line.match(/^\d+\./)) {
        return `${index + 1}. ${line.replace(/^\d+\./, '').trim()}`
      }
      // Bullet points with different symbols
      else if (line.includes('-')) {
        return `• ${line.replace(/-/g, '').trim()}`
      }
      // Alphabetized list
      else if (line.match(/^[a-z]\)/)) {
        const letter = String.fromCharCode(97 + index) + ')'
        return `${letter} ${line.replace(/^[a-z]\)/, '').trim()}`
      }
      // Default to paragraph for other lines
      return line.trim()
    })

    return formattedLines.join('\n')
  }

  const handleSendMessage = async (userInput: string) => {
    if (!userInput.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: userInput,
      role: "user",
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    try {
      // Call your actual backend endpoint
      const res = await fetch("http://localhost:5000/file/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: userInput }),
      })

      if (!res.ok) {
        throw new Error("Failed to fetch assistant response")
      }

      const data = await res.json()

      // Format the API response with varied formatting
      const formattedAnswer = formatResponse(data.answer ?? "Sorry, I couldn't understand.")

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: formattedAnswer+data.references,
        role: "assistant",
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error(error)
      toast.error("Failed to get a response. Please try again.")
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