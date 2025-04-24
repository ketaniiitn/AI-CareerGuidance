// app/layout.tsx
"use client";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import { SidebarProvider } from "@/components/ui/sidebar"; // Import SidebarProvider
import { AppSidebar } from "@/components/app-sidebar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
  showSidebar = false,
}: Readonly<{
  children: React.ReactNode;
  showSidebar?: boolean;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          {/* Render sidebar only if showSidebar is true */}
          {showSidebar && (
            <SidebarProvider>
              <AppSidebar />
            </SidebarProvider>
          )}

          <main>{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
