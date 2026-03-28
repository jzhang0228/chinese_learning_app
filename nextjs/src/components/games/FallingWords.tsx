"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const WORDS = [
  { char: "人", pinyin: "ren" },
  { char: "大", pinyin: "da" },
  { char: "中", pinyin: "zhong" },
  { char: "国", pinyin: "guo" },
  { char: "我", pinyin: "wo" },
  { char: "你", pinyin: "ni" },
  { char: "他", pinyin: "ta" },
  { char: "好", pinyin: "hao" },
  { char: "是", pinyin: "shi" },
  { char: "的", pinyin: "de" },
  { char: "了", pinyin: "le" },
  { char: "在", pinyin: "zai" },
  { char: "有", pinyin: "you" },
  { char: "不", pinyin: "bu" },
  { char: "这", pinyin: "zhe" },
  { char: "来", pinyin: "lai" },
  { char: "去", pinyin: "qu" },
  { char: "看", pinyin: "kan" },
  { char: "说", pinyin: "shuo" },
  { char: "吃", pinyin: "chi" },
];

interface FallingWord {
  id: number;
  char: string;
  pinyin: string;
  x: number; // 0-100 percentage
  y: number; // 0-100 percentage
  speed: number;
}

const GAME_DURATION = 45;

export default function FallingWords() {
  const [words, setWords] = useState<FallingWord[]>([]);
  const [input, setInput] = useState("");
  const [score, setScore] = useState(0);
  const [missed, setMissed] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [playing, setPlaying] = useState(false);
  const [combo, setCombo] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const nextId = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const startGame = useCallback(() => {
    setWords([]);
    setInput("");
    setScore(0);
    setMissed(0);
    setTimeLeft(GAME_DURATION);
    setCombo(0);
    setFlash(null);
    setPlaying(true);
    nextId.current = 0;
    inputRef.current?.focus();
  }, []);

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

  // Spawn words
  useEffect(() => {
    if (!playing) return;
    const spawn = setInterval(() => {
      const w = WORDS[Math.floor(Math.random() * WORDS.length)];
      const newWord: FallingWord = {
        id: nextId.current++,
        char: w.char,
        pinyin: w.pinyin,
        x: 10 + Math.random() * 80,
        y: 0,
        speed: 0.3 + Math.random() * 0.4,
      };
      setWords((prev) => [...prev, newWord]);
    }, 1500);
    return () => clearInterval(spawn);
  }, [playing]);

  // Animate falling
  useEffect(() => {
    if (!playing) return;
    const frame = setInterval(() => {
      setWords((prev) => {
        const alive: FallingWord[] = [];
        let newMissed = 0;
        for (const w of prev) {
          const newY = w.y + w.speed;
          if (newY >= 100) {
            newMissed++;
          } else {
            alive.push({ ...w, y: newY });
          }
        }
        if (newMissed > 0) {
          setMissed((m) => m + newMissed);
          setCombo(0);
        }
        return alive;
      });
    }, 50);
    return () => clearInterval(frame);
  }, [playing]);

  const handleSubmit = () => {
    if (!playing || !input.trim()) return;
    const typed = input.trim().toLowerCase();
    const match = words.find((w) => w.pinyin === typed);
    if (match) {
      setWords((prev) => prev.filter((w) => w.id !== match.id));
      const newCombo = combo + 1;
      setCombo(newCombo);
      const points = newCombo >= 3 ? 2 : 1;
      setScore((s) => s + points);
      setFlash(match.char);
      setTimeout(() => setFlash(null), 400);
    }
    setInput("");
  };

  const gameOver = !playing && timeLeft === 0;

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Type the pinyin of falling characters before they reach the bottom!
      </p>

      {/* Stats */}
      <div className="flex gap-6 text-center">
        <div>
          <div className="text-xs uppercase" style={{ color: "var(--muted)" }}>Score</div>
          <div className="text-xl font-bold text-green-600">{score}</div>
        </div>
        <div>
          <div className="text-xs uppercase" style={{ color: "var(--muted)" }}>Missed</div>
          <div className="text-xl font-bold text-red-500">{missed}</div>
        </div>
        <div>
          <div className="text-xs uppercase" style={{ color: "var(--muted)" }}>Combo</div>
          <div className="text-xl font-bold text-orange-500">{combo >= 3 ? `${combo}x!` : combo}</div>
        </div>
        <div>
          <div className="text-xs uppercase" style={{ color: "var(--muted)" }}>Time</div>
          <div className={`text-xl font-bold ${timeLeft <= 5 ? "text-red-500" : ""}`} style={timeLeft > 5 ? { color: "var(--foreground)" } : undefined}>
            {timeLeft}s
          </div>
        </div>
      </div>

      {/* Game area */}
      <div
        className="relative border-2 rounded-lg overflow-hidden"
        style={{
          width: 360,
          height: 400,
          borderColor: "var(--card-border)",
          backgroundColor: "#fafafa",
        }}
      >
        {/* Danger zone */}
        <div
          className="absolute bottom-0 left-0 right-0 h-8 opacity-20"
          style={{ backgroundColor: "red" }}
        />

        {/* Flash */}
        {flash && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-6xl font-bold text-green-500 opacity-50 animate-ping">
              {flash}
            </span>
          </div>
        )}

        {/* Falling words */}
        {words.map((w) => (
          <div
            key={w.id}
            className="absolute text-center transition-none"
            style={{
              left: `${w.x}%`,
              top: `${w.y}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <div className="text-2xl">{w.char}</div>
          </div>
        ))}
      </div>

      {/* Input */}
      {playing && (
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value.replace(/[^a-zA-Z]/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className="px-4 py-2 border-2 border-gray-300 rounded-lg text-center text-lg w-40 focus:outline-none focus:border-blue-500"
            placeholder="pinyin"
            autoFocus
          />
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go
          </button>
        </div>
      )}

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
            Time&apos;s up! Score: {score} | Missed: {missed}
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
