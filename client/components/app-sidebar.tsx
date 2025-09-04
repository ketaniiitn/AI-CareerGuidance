"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import {
  BookOpen,
  BriefcaseBusiness,
  GraduationCap,
  Home,
  Lightbulb,
  MessageSquare,
  PanelLeft,
  Settings,
  User2,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useUser } from "@clerk/nextjs"

// ✅ CHANGED: The Chat interface now expects a string ID
interface Chat {
  id: string
  title: string
}

export function AppSidebar() {
  const pathname = usePathname()
  const [searchQuery, setSearchQuery] = useState("")
  const [recentChats, setRecentChats] = useState<Chat[]>([])
  const { user } = useUser()

  useEffect(() => {
    async function fetchChats() {
      try {
        const response = await fetch("https://ai-careerguidance.onrender.com/file/conversationsh", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id: user?.id }),
        })

        const data = await response.json()
        console.log("Fetched chats:", data)
        if (data.success && Array.isArray(data.data)) {
          const chats = data.data.map((id: string) => ({
            id,
            title: `Chat ${id.substring(5, 12)}...`,
          }))
          setRecentChats(chats)
        } else {
          setRecentChats([])
        }
      } catch (error) {
        console.error("Failed to fetch chats:", error)
      }
    }

    if (user?.id) {
      fetchChats()
    }
  }, [user?.id])

  const mainNavItems = [
    {
      title: "Home",
      icon: Home,
      href: "/",
      isActive: pathname === "/",
    },
    {
      title: "Career Guidance",
      icon: BriefcaseBusiness,
      href: "/career-guidance-home",
      isActive: pathname.startsWith("/career-guidance"),
    },
    {
      title: "Learning Paths",
      icon: GraduationCap,
      href: "/learning-paths",
      isActive: pathname === "/learning-paths",
    },
  ]

  const resourcesItems = [
    {
      title: "Career Resources",
      icon: BookOpen,
      href: "/resources",
      isActive: pathname === "/resources",
    },
    {
      title: "Career Ideas",
      icon: Lightbulb,
      href: "/ideas",
      isActive: pathname === "/ideas",
    },
  ]

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2">
          <PanelLeft className="h-6 w-6" />
          <h2 className="text-lg font-semibold">Career Guide</h2>
        </div>
        <div className="px-2 pt-2">
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9"
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={item.isActive} tooltip={item.title}>
                    <a href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Resources</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {resourcesItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={item.isActive} tooltip={item.title}>
                    <a href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Recent Chats</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {recentChats.length === 0 ? (
                <div className="text-xs text-muted-foreground p-2">No recent chats</div>
              ) : (
                recentChats.map((chat) => (
                  <SidebarMenuItem key={chat.id}>
                    <SidebarMenuButton asChild tooltip={chat.title}>
                      <a href={`/chat/${chat.id}`}>
                        <MessageSquare />
                        <span>{chat.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback>
                <User2 className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-medium">Your Profile</span>
              <span className="text-xs text-muted-foreground">Manage account</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" asChild>
            <a href="/settings">
              <Settings className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}