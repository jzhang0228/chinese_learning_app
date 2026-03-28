"use client";

import { useStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import AudioPlayer from "@/components/AudioPlayer";
import SpeechRecorder from "@/components/SpeechRecorder";
import ProgressBar from "@/components/ProgressBar";

export default function PronunciationQuizPage() {
  const store = useStore();
  const router = useRouter();
  const [result, setResult] = useState<string>("");
  const [passed, setPassed] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [checking, setChecking] = useState(false);
  const [heardPinyin, setHeardPinyin] = useState("");

  const handleResult = useCallback(
    async (transcript: string) => {
      setResult(transcript);
      setHeardPinyin("");
      setChecking(true);
      try {
        const res = await fetch("/api/check-pronunciation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expected: store.chineseText,
            transcript,
            expectedPinyin: store.pinyinText,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.transcriptPinyin) setHeardPinyin(data.transcriptPinyin);
          if (data.passed) {
            setPassed(true);
            setFeedback("Great pronunciation!");
            store.setPronQuizPassed(true);
          } else {
            setFeedback(`Not quite. Try again!`);
          }
        } else {
          setFeedback(`Not quite. You said "${transcript}". Try again!`);
        }
      } catch {
        setFeedback(`Not quite. You said "${transcript}". Try again!`);
      }
      setChecking(false);
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

      {checking && (
        <div className="mt-4 px-5 py-3 rounded-xl text-sm font-medium bg-blue-50 text-blue-700">
          Checking pronunciation...
        </div>
      )}

      {!checking && feedback && (
        <div
          className={`mt-4 px-5 py-3 rounded-xl text-sm font-medium text-center ${
            passed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          {heardPinyin && <div className="mb-1">Heard: <strong>{heardPinyin}</strong></div>}
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
