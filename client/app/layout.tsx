import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ClerkProvider } from "@clerk/nextjs"
import { ThemeProvider } from "@/components/theme-provider"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "Career Guide",
  description: "Your personal career guidance assistant",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Snapshot user preference (server side we assume light to keep deterministic HTML)
  const initialClass = `${inter.variable} antialiased` // don't include dynamic theme class at SSR
  return (
    <ClerkProvider>
      <html lang="en" className={initialClass} suppressHydrationWarning>
        <body className="font-sans">
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
            {children}
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}