"use client";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Code, Briefcase, Lightbulb } from "lucide-react";
import { LogIn } from 'lucide-react';
export function HeroSectionOne() {
  const router = useRouter();
  const [activeFeature, setActiveFeature] = useState(0);

  const features = [
    { icon: <Code className="h-5 w-5" />, text: "Trending Technologies" },
    { icon: <Briefcase className="h-5 w-5" />, text: "Industry Insights" },
    { icon: <Lightbulb className="h-5 w-5" />, text: "AI-powered Guidance" },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length);
    }, 1000);
    return () => clearInterval(interval);
  }, [features.length]);

  const handleExploreClick = () => {
    router.push("/sign-up");
  };

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col items-center justify-center px-4 bg-gradient-to-b from-white to-gray-50 dark:from-gray-950 dark:to-black">
      {/* ✅ Fixed: Add pointer-events-none */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -left-20 top-20 h-[300px] w-[300px] rounded-full bg-blue-400/10 blur-3xl" />
        <div className="absolute right-20 top-60 h-[250px] w-[350px] rounded-full bg-purple-400/10 blur-3xl" />
        <div className="absolute bottom-20 left-40 h-[200px] w-[300px] rounded-full bg-pink-400/10 blur-3xl" />
      </div>

      <Navbar />

      {/* Border decorations */}
      <div className="absolute inset-y-0 left-0 h-full w-px bg-neutral-200/80 dark:bg-neutral-800/80">
        <div className="absolute top-0 h-40 w-px bg-gradient-to-b from-transparent via-blue-500 to-transparent" />
      </div>
      <div className="absolute inset-y-0 right-0 h-full w-px bg-neutral-200/80 dark:bg-neutral-800/80">
        <div className="absolute h-40 w-px bg-gradient-to-b from-transparent via-blue-500 to-transparent" />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-px w-full bg-neutral-200/80 dark:bg-neutral-800/80">
        <div className="absolute mx-auto h-px w-40 bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
      </div>

      <div className="px-4 py-10 md:py-20">
        {/* Animated Headline */}
        <h1 className="relative z-10 mx-auto max-w-4xl text-center text-2xl font-bold text-slate-700 md:text-4xl lg:text-7xl dark:text-slate-300">
          {"Your Personalized Guide to the Right Career Path"
            .split(" ")
            .map((word, index) => (
              <motion.span
                key={index}
                initial={{ opacity: 0, filter: "blur(4px)", y: 10 }}
                animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                transition={{
                  duration: 0.3,
                  delay: index * 0.1,
                  ease: "easeInOut",
                }}
                className="mr-2 inline-block"
              >
                {word}
              </motion.span>
            ))}
        </h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.8 }}
          className="relative z-10 mx-auto max-w-xl py-4 text-center text-lg font-normal text-neutral-600 dark:text-neutral-400"
        >
          Discover trending technologies, explore industry insights, and get
          AI-powered career guidance tailored just for you. Your future starts
          with the right direction.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 1 }}
          className="relative z-10 mt-8 flex flex-wrap items-center justify-center gap-4"
        >
          <button
            onClick={handleExploreClick}
            className="w-60 transform rounded-lg bg-black px-6 py-2 font-medium text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
          >
            Get Started
          </button>
          <button className="w-60 transform rounded-lg border border-gray-300 bg-white px-6 py-2 font-medium text-black transition-all duration-300 hover:-translate-y-0.5 hover:bg-gray-100 dark:border-gray-700 dark:bg-black dark:text-white dark:hover:bg-gray-900">
            Contact Support
          </button>
        </motion.div>

        {/* Feature Highlights */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.7 }}
          className="relative z-10 mx-auto mt-8 max-w-md"
        >
          <p className="mb-3 text-center text-sm font-medium text-gray-500 dark:text-gray-400">
            Discover what we offer:
          </p>
          <div className="flex flex-col space-y-2">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{
                  opacity: activeFeature === index ? 1 : 0.6,
                  x: 0,
                  scale: activeFeature === index ? 1 : 0.98,
                }}
                transition={{ duration: 0.3 }}
                className={`flex items-center justify-center space-x-2 rounded-lg px-3 py-2 ${
                  activeFeature === index
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    : "text-gray-600 dark:text-gray-400"
                }`}
              >
                {feature.icon}
                <span>{feature.text}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Preview Image */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 1.2 }}
          className="relative z-10 mt-20 rounded-3xl border border-neutral-200 bg-neutral-100 p-4 shadow-md dark:border-neutral-800 dark:bg-neutral-900"
        >
            <div className="w-full overflow-hidden rounded-xl border border-gray-300 dark:border-gray-700">
              <img
              src="/home.png"
              alt="Landing page preview"
              className="h-auto w-full object-contain"
              height={1000}
              width={1000}
              />
            </div>
        </motion.div>
      </div>
    </div>
  );
}

// Navbar component
const Navbar = () => {
  const router = useRouter();

  const handleExploreClick = () => {
    console.log("SignIn button clicked");
    router.push("/sign-in");
  };

  return (
    <nav className="flex w-full items-center justify-between border-t border-b border-neutral-200 px-4 py-4 dark:border-neutral-800">
      <div className="flex items-center gap-2">
        <motion.div
          whileHover={{ rotate: 10 }}
          className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-violet-600"
        >
          <span className="text-sm font-bold text-white">C</span>
        </motion.div>
        <h1 className="text-base font-bold md:text-2xl">CareerPath AI</h1>
      </div>
      <button
        style={{ position: "relative", zIndex: 9999 }}
        className="pointer-events-auto"
        onClick={handleExploreClick}
      ><div className="flex items-center gap-2">
        <LogIn />
        SignIn</div>
      </button>
    </nav>
  );
};
