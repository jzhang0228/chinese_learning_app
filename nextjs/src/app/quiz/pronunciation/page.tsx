"use client";

import { useStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import AudioPlayer from "@/components/AudioPlayer";
import SpeechRecorder from "@/components/SpeechRecorder";
import ProgressBar from "@/components/ProgressBar";

function countCJKMatch(a: string, b: string): number {
  const cjkRegex = /[\u4e00-\u9fff]/g;
  const charsA: string[] = a.match(cjkRegex) || [];
  const charsB: string[] = b.match(cjkRegex) || [];
  if (charsB.length === 0) return 0;
  let matches = 0;
  for (const ch of charsB) {
    if (charsA.includes(ch)) matches++;
  }
  return matches / charsB.length;
}

export default function PronunciationQuizPage() {
  const store = useStore();
  const router = useRouter();
  const [result, setResult] = useState<string>("");
  const [passed, setPassed] = useState(false);
  const [feedback, setFeedback] = useState("");

  const handleResult = useCallback(
    (transcript: string) => {
      setResult(transcript);
      const score = countCJKMatch(transcript, store.chineseText);
      if (score >= 0.6) {
        setPassed(true);
        setFeedback("Great pronunciation! You matched the character.");
        store.setPronQuizPassed(true);
      } else {
        setFeedback(`Not quite. You said "${transcript}". Try again!`);
      }
    },
    [store]
  );

  const handleNext = () => {
    store.setStage("sentences");
    router.push("/sentences");
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
      <ProgressBar step={2} total={8} label="Learning Progress" />

      <h2 className="text-xl font-semibold mb-4" style={{ color: "var(--foreground)" }}>
        Pronunciation Quiz
      </h2>

      <div className="big-char mb-2">{store.chineseText}</div>
      <div className="pinyin mb-6">{store.pinyinText}</div>

      <div className="mb-4">
        <AudioPlayer text={store.chineseText} />
      </div>

      <div className="quiz-box w-full max-w-md text-center">
        <p className="text-sm mb-4" style={{ color: "var(--foreground)" }}>
          Listen to the audio, then try to pronounce the character.
        </p>
        <SpeechRecorder onResult={handleResult} />
      </div>

      {feedback && (
        <div
          className={`mt-4 px-5 py-3 rounded-xl text-sm font-medium ${
            passed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          {feedback}
        </div>
      )}

      {passed && (
        <button onClick={handleNext} className="btn-accent mt-6 text-lg py-3 px-8">
          Next: Sentences
        </button>
      )}
    </div>
  );
}
