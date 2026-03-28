"use client";

import { useStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import WritingCanvas from "@/components/WritingCanvas";
import ProgressBar from "@/components/ProgressBar";
import { useState } from "react";

export default function WritingPage() {
  const store = useStore();
  const router = useRouter();
  const [drawingData, setDrawingData] = useState("");

  const handleNext = () => {
    store.setStage("writing-quiz");
    router.push("/writing-quiz");
  };

  if (!store.chineseText) {
    return (
      <div className="flex flex-col items-center pt-12">
        <p style={{ color: "var(--muted)" }}>No word selected.</p>
        <button onClick={() => router.push("/")} className="btn-ghost mt-4">
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center pt-4">
      <ProgressBar step={5} total={8} label="Learning Progress" />

      <h2 className="text-xl font-semibold mb-4" style={{ color: "var(--foreground)" }}>
        Writing Practice
      </h2>

      <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
        Practice writing the character by tracing over the reference.
      </p>

      {/* Reference character */}
      <div
        className="relative mb-6 border-2 border-dashed rounded-2xl flex items-center justify-center"
        style={{
          width: 300,
          height: 300,
          borderColor: "var(--card-border)",
          backgroundColor: "#fafbfc",
        }}
      >
        <span
          className="text-9xl select-none"
          style={{ color: "rgba(59, 130, 246, 0.12)" }}
        >
          {store.chineseText}
        </span>
      </div>

      <div className="mb-3 text-sm font-medium" style={{ color: "var(--foreground)" }}>
        Now practice writing it yourself:
      </div>

      <WritingCanvas
        width={300}
        height={300}
        onDrawingChange={setDrawingData}
      />

      <button onClick={handleNext} className="btn-accent mt-6 text-lg py-3 px-8">
        Take Writing Quiz
      </button>
    </div>
  );
}
