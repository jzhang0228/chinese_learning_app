"use client";

import { useStore } from "@/lib/store";
import { useRouter } from "next/navigation";

interface ReviewWord {
  chinese: string;
  pinyin: string;
  english: string;
}

interface ReviewResultsProps {
  won: ReviewWord[];
  lost: ReviewWord[];
}

export default function ReviewResults({ won, lost }: ReviewResultsProps) {
  const store = useStore();
  const router = useRouter();

  const handleRelearn = (word: ReviewWord) => {
    store.setWord(word.english, word.chinese, word.pinyin);
    store.setStage("learn");
    window.open("/learn", "_blank");
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-md mx-auto mt-6">
      {/* Words Won */}
      {won.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--accent)" }}>
            Words You Got Right ({won.length})
          </h3>
          <div className="flex flex-col gap-2">
            {won.map((w, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50"
                style={{ border: "1px solid #d1fae5" }}
              >
                <span className="text-2xl font-light min-w-[48px]" style={{ color: "var(--char-color)" }}>
                  {w.chinese}
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                    {w.pinyin}
                  </span>
                  <span className="text-sm" style={{ color: "var(--muted)" }}>
                    {w.english}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Words Lost */}
      {lost.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: "#f59e0b" }}>
            Words to Review ({lost.length})
          </h3>
          <div className="flex flex-col gap-2">
            {lost.map((w, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-4 py-3 rounded-xl bg-amber-50"
                style={{ border: "1px solid #fde68a" }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-light min-w-[48px]" style={{ color: "var(--char-color)" }}>
                    {w.chinese}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                      {w.pinyin}
                    </span>
                    <span className="text-sm" style={{ color: "var(--muted)" }}>
                      {w.english}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleRelearn(w)}
                  className="btn-primary text-xs py-1.5 px-3 whitespace-nowrap"
                >
                  Re-learn
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
