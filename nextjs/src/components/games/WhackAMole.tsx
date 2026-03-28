"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const CHARS = [
  { char: "大", meaning: "big" },
  { char: "小", meaning: "small" },
  { char: "上", meaning: "up" },
  { char: "下", meaning: "down" },
  { char: "左", meaning: "left" },
  { char: "右", meaning: "right" },
  { char: "人", meaning: "person" },
  { char: "口", meaning: "mouth" },
  { char: "手", meaning: "hand" },
  { char: "目", meaning: "eye" },
  { char: "耳", meaning: "ear" },
  { char: "心", meaning: "heart" },
  { char: "天", meaning: "sky" },
  { char: "地", meaning: "ground" },
  { char: "水", meaning: "water" },
  { char: "火", meaning: "fire" },
];

const GRID = 9; // 3x3
const GAME_DURATION = 30;
const MOLE_DURATION = 1200;
const SPAWN_INTERVAL = 800;

export default function WhackAMole() {
  const [moles, setMoles] = useState<Map<number, typeof CHARS[0]>>(new Map());
  const [target, setTarget] = useState(CHARS[0]);
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [playing, setPlaying] = useState(false);
  const [flash, setFlash] = useState<{ idx: number; correct: boolean } | null>(null);
  const molesRef = useRef(moles);
  molesRef.current = moles;

  const pickTarget = useCallback(() => {
    return CHARS[Math.floor(Math.random() * CHARS.length)];
  }, []);

  const startGame = useCallback(() => {
    setMoles(new Map());
    setScore(0);
    setMisses(0);
    setTimeLeft(GAME_DURATION);
    setTarget(pickTarget());
    setPlaying(true);
    setFlash(null);
  }, [pickTarget]);

  // Timer
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          setPlaying(false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [playing]);

  // Spawn moles
  useEffect(() => {
    if (!playing) return;
    const spawn = setInterval(() => {
      const current = molesRef.current;
      if (current.size >= 4) return; // max 4 visible

      const available: number[] = [];
      for (let i = 0; i < GRID; i++) if (!current.has(i)) available.push(i);
      if (available.length === 0) return;

      const idx = available[Math.floor(Math.random() * available.length)];
      // 40% chance it's the target character
      const char = Math.random() < 0.4 ? target : CHARS[Math.floor(Math.random() * CHARS.length)];

      setMoles((prev) => {
        const next = new Map(prev);
        next.set(idx, char);
        return next;
      });

      // Auto-remove after duration
      setTimeout(() => {
        setMoles((prev) => {
          const next = new Map(prev);
          next.delete(idx);
          return next;
        });
      }, MOLE_DURATION);
    }, SPAWN_INTERVAL);
    return () => clearInterval(spawn);
  }, [playing, target]);

  const handleWhack = (idx: number) => {
    if (!playing) return;
    const char = moles.get(idx);
    if (!char) return;

    if (char.char === target.char) {
      setScore((s) => s + 1);
      setFlash({ idx, correct: true });
      // Remove and pick new target
      setMoles((prev) => {
        const next = new Map(prev);
        next.delete(idx);
        return next;
      });
      setTarget(pickTarget());
    } else {
      setMisses((m) => m + 1);
      setFlash({ idx, correct: false });
    }
    setTimeout(() => setFlash(null), 300);
  };

  const gameOver = !playing && timeLeft === 0;

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Tap the character that matches the target!
      </p>

      {/* Target */}
      <div className="text-center">
        <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--muted)" }}>
          Find this character
        </div>
        <div className="text-5xl font-light" style={{ color: "var(--char-color, var(--foreground))" }}>
          {target.char}
        </div>
        <div className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          {target.meaning}
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-6 text-center">
        <div>
          <div className="text-xs uppercase" style={{ color: "var(--muted)" }}>Score</div>
          <div className="text-xl font-bold text-green-600">{score}</div>
        </div>
        <div>
          <div className="text-xs uppercase" style={{ color: "var(--muted)" }}>Misses</div>
          <div className="text-xl font-bold text-red-500">{misses}</div>
        </div>
        <div>
          <div className="text-xs uppercase" style={{ color: "var(--muted)" }}>Time</div>
          <div className={`text-xl font-bold ${timeLeft <= 5 ? "text-red-500" : ""}`} style={timeLeft > 5 ? { color: "var(--foreground)" } : undefined}>
            {timeLeft}s
          </div>
        </div>
      </div>

      {/* Grid */}
      <div
        className="inline-grid gap-3"
        style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
      >
        {Array.from({ length: GRID }, (_, i) => {
          const mole = moles.get(i);
          const isFlash = flash?.idx === i;
          return (
            <button
              key={i}
              onClick={() => handleWhack(i)}
              className={`w-24 h-24 rounded-2xl text-3xl font-bold transition-all border-2 ${
                isFlash
                  ? flash.correct
                    ? "bg-green-300 border-green-500 scale-95"
                    : "bg-red-300 border-red-500 scale-95"
                  : mole
                  ? "bg-amber-100 border-amber-400 hover:bg-amber-200 cursor-pointer animate-bounce"
                  : "bg-gray-100 border-gray-200"
              }`}
              disabled={!mole || !playing}
            >
              {mole ? (
                <span>{mole.char}</span>
              ) : (
                <span className="text-gray-300 text-xl">&#x2022;</span>
              )}
            </button>
          );
        })}
      </div>

      {!playing && !gameOver && (
        <button
          onClick={startGame}
          className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg"
        >
          Start Game
        </button>
      )}

      {gameOver && (
        <div className="flex flex-col items-center gap-3">
          <div className="px-6 py-3 bg-green-500 text-white rounded-lg text-lg font-semibold">
            Time&apos;s up! Score: {score} | Misses: {misses}
          </div>
          <button
            onClick={startGame}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Play Again
          </button>
        </div>
      )}
    </div>
  );
}
