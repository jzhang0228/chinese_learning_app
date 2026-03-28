"use client";

import { useStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import SpeechRecorder from "@/components/SpeechRecorder";
import ProgressBar from "@/components/ProgressBar";

export default function SentenceQuizPage() {
  const store = useStore();
  const router = useRouter();
  const [passed, setPassed] = useState(false);
  const [feedback, setFeedback] = useState("");

  const handleResult = useCallback(
    (transcript: string) => {
      const cjkRegex = /[\u4e00-\u9fff]/g;
      const cjkChars: string[] = transcript.match(cjkRegex) || [];
      const containsChar = transcript.includes(store.chineseText);
      const longEnough = cjkChars.length >= 3;

      if (containsChar && longEnough) {
        setPassed(true);
        setFeedback(`Excellent! Your sentence: "${transcript}"`);
        store.setSentQuizPassed(true);
      } else if (!containsChar) {
        setFeedback(
          `Your sentence "${transcript}" doesn't contain ${store.chineseText}. Try again!`
        );
      } else {
        setFeedback(
          `Your sentence "${transcript}" is too short. Try making a longer sentence!`
        );
      }
    },
    [store]
  );

  const handleNext = () => {
    store.setStage("writing");
    router.push("/writing");
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
      <ProgressBar step={4} total={8} label="Learning Progress" />

      <h2 className="text-xl font-semibold mb-4" style={{ color: "var(--foreground)" }}>
        Sentence Quiz
      </h2>

      <div className="big-char mb-6">{store.chineseText}</div>

      <div className="quiz-box w-full max-w-md text-center">
        <p className="text-sm mb-4" style={{ color: "var(--foreground)" }}>
          Say a sentence using <strong>{store.chineseText}</strong> ({store.englishWord}).
          <br />
          <span style={{ color: "var(--muted)" }}>
            Must contain the character and be at least 3 characters long.
          </span>
        </p>
        <SpeechRecorder onResult={handleResult} />
      </div>

      {feedback && (
        <div
          className={`mt-4 px-5 py-3 rounded-xl text-sm font-medium max-w-md text-center ${
            passed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          {feedback}
        </div>
      )}

      {passed && (
        <button onClick={handleNext} className="btn-accent mt-6 text-lg py-3 px-8">
          Next: Writing Practice
        </button>
      )}
    </div>
  );
}
