"use client"

import { Bot, User2 } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import ReactMarkdown from "react-markdown" // Import ReactMarkdown
import type { Message } from "./chat-layout"

interface ChatMessageProps {
  message: Message
}

export function ChatMessage({ message }: ChatMessageProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 max-w-[80%]",
        message.role === "user" ? "ml-auto justify-end" : "justify-start",
      )}
    >
      {message.role === "assistant" && (
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary text-primary-foreground">
            <Bot className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}

      <Card className={cn("p-3 text-sm", message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted")}>
        {/* Render the content as Markdown */}
        <div
          className={cn("markdown-content", message.role === "user" ? "text-primary-foreground" : "text-foreground")}
        >
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
        <div
          className={cn(
            "text-xs mt-1",
            message.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground",
          )}
        >
          {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </Card>

      {message.role === "user" && (
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary text-primary-foreground">
            <User2 className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  )
}
