"use client";

import { useStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
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

export default function SentencesPage() {
  const store = useStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [feedbacks, setFeedbacks] = useState<Record<number, string>>({});

  const fetchedRef = useRef(false);
  useEffect(() => {
    if (fetchedRef.current) return;
    if (store.chineseText && store.exampleSentences.length === 0) {
      fetchedRef.current = true;
      fetchSentences();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchSentences = async () => {
    try {
      const res = await fetch("/api/sentences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chinese_text: store.chineseText,
          english_word: store.englishWord,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        store.setExampleSentences(data.sentences || []);
      }
    } catch {}
    setLoading(false);
  };

  const handleSpeechResult = useCallback(
    (index: number, transcript: string) => {
      const sentence = store.exampleSentences[index];
      const score = countCJKMatch(transcript, sentence.chinese);
      if (score >= 0.6) {
        store.addSentenceSpoken(index);
        setFeedbacks((prev) => ({ ...prev, [index]: "Great job!" }));
      } else {
        setFeedbacks((prev) => ({
          ...prev,
          [index]: `Not quite. You said: "${transcript}". Try again!`,
        }));
      }
    },
    [store]
  );

  const allSpoken =
    store.exampleSentences.length > 0 &&
    store.exampleSentences.every((_, i) => store.sentencesSpoken.includes(i));

  const handleNext = () => {
    store.setStage("sentence-quiz");
    router.push("/quiz/sentence");
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

  if (loading) {
    return (
      <div className="flex flex-col items-center pt-12">
        <p style={{ color: "var(--muted)" }}>Loading sentences...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col pt-4">
      <ProgressBar step={3} total={8} label="Learning Progress" />

      <h2 className="text-xl font-semibold mb-4 text-center" style={{ color: "var(--foreground)" }}>
        Example Sentences
      </h2>

      <div className="flex flex-col gap-3">
        {store.exampleSentences.map((sentence, i) => {
          const spoken = store.sentencesSpoken.includes(i);
          return (
            <div
              key={i}
              className="quiz-box"
              style={{
                borderLeftColor: spoken ? "var(--accent)" : "var(--primary)",
              }}
            >
              <div className="text-2xl font-semibold mb-1" style={{ color: "var(--foreground)" }}>
                {sentence.chinese}
              </div>
              <div className="text-sm mb-1" style={{ color: "var(--foreground)", letterSpacing: "2px" }}>
                {sentence.pinyin}
              </div>
              <div className="text-base mb-3" style={{ color: "var(--muted)" }}>
                {sentence.english}
              </div>

              <div className="flex items-center gap-3 mb-2">
                <AudioPlayer text={sentence.chinese} />
                {spoken && (
                  <span className="text-emerald-600 text-sm font-medium">Completed</span>
                )}
              </div>

              {!spoken && (
                <SpeechRecorder onResult={(t) => handleSpeechResult(i, t)} />
              )}

              {feedbacks[i] && (
                <div
                  className={`mt-2 text-sm font-medium ${
                    spoken ? "text-emerald-600" : "text-amber-600"
                  }`}
                >
                  {feedbacks[i]}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {allSpoken && (
        <div className="mt-6 text-center">
          <button onClick={handleNext} className="btn-accent text-lg py-3 px-8">
            Next: Sentence Quiz
          </button>
        </div>
      )}
    </div>
  );
}
