"use client"

import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import ChatLayout from "@/components/chat-component/chat-layout"
import { Navbar } from "@/components/navbar"
import { Toaster } from "@/components/ui/sonner"


export default function CareerGuidanceHome() {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-background">
        {/* App Sidebar */}
        <AppSidebar />

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          <Navbar>
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold">Career Guidance Assistant</h1>
            </div>
          </Navbar>

          {/* Main Chat Interface */}
          <div className="flex-1 relative overflow-hidden">
            <ChatLayout />
          </div>
        </div>
      </div>
      <Toaster />
    </SidebarProvider>
  )
}
