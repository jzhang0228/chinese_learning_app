"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import MemoryMatch from "@/components/games/MemoryMatch";

interface Word {
  chinese: string;
  english: string;
  pinyin: string;
}

export default function ReviewMemoryPage() {
  const router = useRouter();
  const [pairs, setPairs] = useState<Word[] | null>(null);
  const [won, setWon] = useState(false);
  const [error, setError] = useState("");
  const [gameKey, setGameKey] = useState(0);

  const fetchAndSetup = async () => {
    try {
      const res = await fetch("/api/words");
      if (!res.ok) throw new Error("Failed to fetch words");
      const data = await res.json();
      const words: Word[] = (data.words || data).map((w: any) => ({
        chinese: w.chinese,
        english: w.english,
        pinyin: w.pinyin || "",
      }));

      if (words.length < 8) {
        setError("You need at least 8 learned words to play. Keep learning!");
        return;
      }

      const shuffled = [...words].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, 8);
      setPairs(selected);
      setWon(false);
    } catch {
      setError("Could not load words. Please try again later.");
    }
  };

  useEffect(() => {
    fetchAndSetup();
  }, []);

  const handlePlayAgain = () => {
    setPairs(null);
    setWon(false);
    setGameKey((k) => k + 1);
    fetchAndSetup();
  };

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4" style={{ backgroundColor: "var(--background)" }}>
        <p className="text-amber-600 text-lg">{error}</p>
        <button onClick={() => router.push("/")} className="btn-primary">
          Home
        </button>
      </div>
    );
  }

  if (!pairs) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--background)" }}>
        <p style={{ color: "var(--muted)" }} className="text-lg">Loading words...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4" style={{ backgroundColor: "var(--background)" }}>
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
            Review: Memory Match
          </h1>
          <button onClick={() => router.push("/")} className="btn-ghost">
            Home
          </button>
        </div>

        <p className="mb-6 text-center" style={{ color: "var(--muted)" }}>
          Match the Chinese characters with their English translations!
        </p>

        <MemoryMatch
          key={gameKey}
          pairs={pairs}
          onWin={() => setWon(true)}
        />

        {won && (
          <div className="flex justify-center gap-4 mt-6">
            <button onClick={handlePlayAgain} className="btn-accent">
              Play Again
            </button>
            <button onClick={() => router.push("/")} className="btn-primary">
              Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
