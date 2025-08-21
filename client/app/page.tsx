"use client";
import { HeroSectionOne } from "@/components/Hero";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs"; 
import { useEffect } from "react";

export default function HomePage() {
  const router = useRouter();
  const { isSignedIn } = useAuth(); 

  useEffect(() => {
    if (isSignedIn) {
      router.push("/career-guidance-home"); 
    }
  }, [isSignedIn, router]);

  
  return (
    <main className="min-h-screen w-full overflow-hidden bg-white dark:bg-black">
      <HeroSectionOne />
    </main>
  );
}