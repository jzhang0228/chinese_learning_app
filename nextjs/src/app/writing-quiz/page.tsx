"use client";

import { useStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import WritingCanvas from "@/components/WritingCanvas";
import ProgressBar from "@/components/ProgressBar";
import { useState } from "react";

export default function WritingQuizPage() {
  const store = useStore();
  const router = useRouter();
  const [drawingData, setDrawingData] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<"pass" | "fail" | null>(null);
  const [showReference, setShowReference] = useState(false);
  const [clearTrigger, setClearTrigger] = useState(0);

  const checkWriting = async () => {
    if (!drawingData) return;
    setChecking(true);
    try {
      const blob = await fetch(drawingData).then((r) => r.blob());
      const formData = new FormData();
      formData.append("image", blob, "drawing.png");
      formData.append("expected", store.chineseText);

      const res = await fetch("/api/recognize", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.passed) {
          setResult("pass");
          store.setWritingQuizPassed(true);
        } else {
          setResult("fail");
          setShowReference(true);
        }
      } else {
        setResult("fail");
        setShowReference(true);
      }
    } catch {
      setResult("fail");
      setShowReference(true);
    }
    setChecking(false);
  };

  const completeLesson = async () => {
    try {
      await fetch("/api/words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: store.username,
          chinese: store.chineseText,
          pinyin: store.pinyinText,
          english: store.englishWord,
        }),
      });
    } catch {}
    store.setStage("celebrate");
    router.push("/celebrate");
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
      <ProgressBar step={6} total={8} label="Learning Progress" />

      <h2 className="text-xl font-semibold mb-4" style={{ color: "var(--foreground)" }}>
        Writing Quiz
      </h2>

      <div className="quiz-box w-full max-w-md text-center mb-6">
        <p className="text-sm" style={{ color: "var(--foreground)" }}>
          Write the character for:
        </p>
        <div className="eng-label mt-1 font-bold">{store.englishWord}</div>
        <div className="pinyin mt-1" style={{ fontSize: "20px" }}>{store.pinyinText}</div>
      </div>

      <WritingCanvas
        width={300}
        height={300}
        onDrawingChange={setDrawingData}
        clearTrigger={clearTrigger}
      />

      {!result && (
        <button
          onClick={checkWriting}
          disabled={checking || !drawingData}
          className="btn-primary mt-5 text-lg py-3 px-8"
        >
          {checking ? "Checking..." : "Check My Writing"}
        </button>
      )}

      {result === "pass" && (
        <div className="mt-5 flex flex-col items-center gap-3">
          <div className="px-5 py-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-medium">
            Correct! Great writing!
          </div>
          <button onClick={completeLesson} className="btn-accent text-lg py-3 px-8">
            Complete Lesson!
          </button>
        </div>
      )}

      {result === "fail" && (
        <div className="mt-5 flex flex-col items-center gap-3">
          <div className="px-5 py-3 rounded-xl bg-amber-50 text-amber-700 text-sm font-medium">
            Not quite right.
          </div>
          {showReference && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                The correct character is:
              </p>
              <div className="big-char">{store.chineseText}</div>
            </div>
          )}
          <button
            onClick={() => {
              setResult(null);
              setShowReference(false);
              setDrawingData("");
              setClearTrigger((t) => t + 1);
            }}
            className="btn-primary text-lg py-3 px-8"
          >
            Try Again
          </button>
          <button onClick={completeLesson} className="btn-ghost text-sm">
            Close enough — continue anyway
          </button>
        </div>
      )}
    </div>
  );
}
