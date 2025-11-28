"use client";

import { Toaster } from "@/components/Toast/toaster";
import DiagramFrame from "@components/DiagramFrame";

export default function Home() {
  return (
    <main className="font-mono text-black dark:text-white h-screen overflow-hidden">
      <div className="flex flex-col h-full">
        <div className="hidden h-16 items-center justify-between bg-green-300">
          <h1 className="">Header</h1>
        </div>
        <div className="flex-1 w-full">
          <DiagramFrame />
          <Toaster />
        </div>
      </div>
    </main>
  );
}
