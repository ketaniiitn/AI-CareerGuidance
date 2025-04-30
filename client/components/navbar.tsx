"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { UserButton, useUser } from "@clerk/nextjs";
import { toast } from "sonner";

interface NavbarProps {
  children?: ReactNode;
}

export function Navbar({ children }: NavbarProps) {
  const [chatId, setChatId] = useState<string | null>(null);
  const router = useRouter();
  const { user, isLoaded } = useUser();

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "https://ai-careerguidance.onrender.com";

  const handleNewChat = () => {
    if (!isLoaded || !user?.id) {
      toast.error("Please wait for user to load.");
      return;
    }

    const newChatId = `chat-${Date.now()}`;
    setChatId(newChatId);

    fetch(`${API_BASE}/file/createConversation/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uid: user.id, id: newChatId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          console.log("New chat created successfully:", data);
        } else {
          toast.error("Failed to create new chat");
        }
      })
      .catch((error) => {
        console.error("Error creating new chat:", error);
        toast.error("Error creating chat.");
      });

    router.push(`/chat/${newChatId}`);
  };

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-4 sm:px-6">
      <SidebarTrigger />
      {children}
      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" className="gap-1" onClick={handleNewChat}>
          <PlusCircle className="h-4 w-4" />
          <span className="hidden sm:inline">New Chat</span>
        </Button>
        <ModeToggle />
        <UserButton />
      </div>
    </header>
  );
}
