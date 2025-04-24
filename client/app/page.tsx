// "use client";
// import { HeroSectionOne } from "@/component/Hero";
// import { useRouter } from "next/navigation";

// export default function HomePage() {
//   const router = useRouter();

//   return (
//     <main className="min-h-screen w-full overflow-hidden bg-white dark:bg-black">
//       <HeroSectionOne />
//     </main>
//   );
// }

"use client";
import { HeroSectionOne } from "@/components/Hero";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs"; // Import Clerk's useAuth hook
import { useEffect } from "react";

export default function HomePage() {
  const router = useRouter();
  const { isSignedIn } = useAuth(); // Check if the user is signed in

  useEffect(() => {
    if (isSignedIn) {
      router.push("/career-guidance-home"); // Redirect to the career page if signed in
    }
  }, [isSignedIn, router]);

  
  return (
    <main className="min-h-screen w-full overflow-hidden bg-white dark:bg-black">
      <HeroSectionOne />
    </main>
  );
}