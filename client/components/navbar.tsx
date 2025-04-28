// "use client"

// import type { ReactNode } from "react"
// import { SidebarTrigger } from "@/components/ui/sidebar"
// import { ModeToggle } from "@/components/mode-toggle"
// import { Button } from "@/components/ui/button"
// import { PlusCircle } from "lucide-react"
// import { UserButton } from "@clerk/nextjs"

// interface NavbarProps {
//   children?: ReactNode
// }

// export function Navbar({ children }: NavbarProps) {
//   return (
//     <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-4 sm:px-6">
//       <SidebarTrigger />

//       {children}

//       <div className="ml-auto flex items-center gap-2">
//         <Button variant="outline" size="sm" className="gap-1">
//           <PlusCircle className="h-4 w-4" />
//           <span className="hidden sm:inline">New Chat</span>
//         </Button>
//         <ModeToggle />
//         <UserButton />
//       </div>
//     </header>
//   )
// }
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation"; // To update the URL
import type { ReactNode } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { UserButton, useUser } from "@clerk/nextjs";

interface NavbarProps {
  children?: ReactNode;
}

export function Navbar({ children }: NavbarProps) {
  const [chatId, setChatId] = useState<string | null>(null);
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();
  // Function to handle new chat creation
  const handleNewChat = () => {
    let newChatId = generateChatId(); // Generate a new unique chat ID
    
    setChatId(newChatId); // Update local state with the new chat ID
    
    const response = fetch(`http://localhost:5000/file/createConversation/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uid: user?.id ,id: newChatId })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          console.log("New chat created successfully:", data);
        } else {
          console.error("Failed to create new chat:", data.message);
        }
      })
      .catch((error) => {
        console.error("Error creating new chat:", error);
      });
    
    // Update the URL with the new chat ID
    router.push(`/chat/${newChatId}`);
  };

  // Function to generate a unique chat ID (you can customize this logic)
  const generateChatId = () => {
    return `chat-${Date.now()}`; // Generate unique ID based on current timestamp
  };

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-4 sm:px-6">
      <SidebarTrigger />

      {children}

      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={handleNewChat} // Handle new chat creation
        >
          <PlusCircle className="h-4 w-4" />
          <span className="hidden sm:inline">New Chat</span>
        </Button>
        <ModeToggle />
        <UserButton />
      </div>
    </header>
  );
}
