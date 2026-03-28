"use client";

import ReviewResults from "@/components/ReviewResults";
import { useRouter } from "next/navigation";

const mockWon = [
  { chinese: "你", pinyin: "nǐ", english: "you" },
  { chinese: "好", pinyin: "hǎo", english: "good" },
  { chinese: "大", pinyin: "dà", english: "big" },
  { chinese: "人", pinyin: "rén", english: "person" },
];

const mockLost = [
  { chinese: "龙", pinyin: "lóng", english: "dragon" },
  { chinese: "鹤", pinyin: "hè", english: "crane" },
  { chinese: "凤", pinyin: "fèng", english: "phoenix" },
];

export default function DevSkyDropResultsPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col pt-4 max-w-xl mx-auto px-4">
      <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--foreground)" }}>
        Sky Drop Results Preview
      </h1>
      <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
        Dev page — previewing the results screen with mock data.
      </p>

      <div className="text-center mb-4">
        <h2 className="text-3xl font-bold text-red-400 mb-2">Game Over</h2>
        <p style={{ color: "var(--foreground)" }}>Final Score: 4</p>
      </div>

      <ReviewResults won={mockWon} lost={mockLost} />

      <button
        onClick={() => router.push("/")}
        className="btn-ghost mt-6 w-full"
      >
        Back to Home
      </button>
    </div>
  );
}
