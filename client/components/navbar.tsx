"use client"

import type { ReactNode } from "react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ModeToggle } from "@/components/mode-toggle"
import { Button } from "@/components/ui/button"
import { PlusCircle } from "lucide-react"
import { UserButton } from "@clerk/nextjs"

interface NavbarProps {
  children?: ReactNode
}

export function Navbar({ children }: NavbarProps) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-4 sm:px-6">
      <SidebarTrigger />

      {children}

      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" className="gap-1">
          <PlusCircle className="h-4 w-4" />
          <span className="hidden sm:inline">New Chat</span>
        </Button>
        <ModeToggle />
        <UserButton />
      </div>
    </header>
  )
}
