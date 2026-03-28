"use client";

import { useStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import AudioPlayer from "@/components/AudioPlayer";
import ProgressBar from "@/components/ProgressBar";

export default function LearnPage() {
  const store = useStore();
  const router = useRouter();

  const handleNext = () => {
    store.setStage("pronunciation");
    router.push("/quiz/pronunciation");
  };

  if (!store.chineseText) {
    return (
      <div className="flex flex-col items-center pt-12">
        <p style={{ color: "var(--muted)" }}>No word selected. Go back to input a word.</p>
        <button onClick={() => router.push("/")} className="btn-ghost mt-4">
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center pt-4">
      <ProgressBar step={1} total={8} label="Learning Progress" />

      <h2 className="text-xl font-semibold mb-6" style={{ color: "var(--foreground)" }}>
        Learn This Character
      </h2>

      <div className="big-char mb-2">{store.chineseText}</div>
      <div className="pinyin mb-1">{store.pinyinText}</div>
      <div className="eng-label mb-8">{store.englishWord}</div>

      <AudioPlayer text={store.chineseText} />

      <div className="mt-8">
        <button onClick={handleNext} className="btn-accent text-lg py-3 px-8">
          Next: Pronunciation Quiz
        </button>
      </div>
    </div>
  );
}
