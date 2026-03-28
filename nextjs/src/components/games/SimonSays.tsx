"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const CHARS = [
  { char: "金", color: "#eab308", meaning: "gold" },
  { char: "木", color: "#22c55e", meaning: "wood" },
  { char: "水", color: "#3b82f6", meaning: "water" },
  { char: "火", color: "#ef4444", meaning: "fire" },
  { char: "土", color: "#a16207", meaning: "earth" },
  { char: "风", color: "#06b6d4", meaning: "wind" },
];

export default function SimonSays() {
  const [sequence, setSequence] = useState<number[]>([]);
  const [playerInput, setPlayerInput] = useState<number[]>([]);
  const [phase, setPhase] = useState<"idle" | "showing" | "input" | "gameover">("idle");
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [round, setRound] = useState(0);
  const [bestRound, setBestRound] = useState(0);
  const [message, setMessage] = useState("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimeouts = () => {
    timeoutRef.current.forEach(clearTimeout);
    timeoutRef.current = [];
  };

  const playSequence = useCallback((seq: number[]) => {
    setPhase("showing");
    setActiveIdx(null);
    clearTimeouts();

    seq.forEach((charIdx, i) => {
      const showTimeout = setTimeout(() => {
        setActiveIdx(charIdx);
      }, i * 700 + 300);

      const hideTimeout = setTimeout(() => {
        setActiveIdx(null);
      }, i * 700 + 700);

      timeoutRef.current.push(showTimeout, hideTimeout);
    });

    const doneTimeout = setTimeout(() => {
      setPhase("input");
      setPlayerInput([]);
      setMessage("Your turn! Repeat the sequence.");
    }, seq.length * 700 + 400);
    timeoutRef.current.push(doneTimeout);
  }, []);

  const startGame = useCallback(() => {
    clearTimeouts();
    const first = Math.floor(Math.random() * CHARS.length);
    const seq = [first];
    setSequence(seq);
    setRound(1);
    setMessage("Watch the sequence...");
    playSequence(seq);
  }, [playSequence]);

  const nextRound = useCallback(() => {
    const next = Math.floor(Math.random() * CHARS.length);
    const newSeq = [...sequence, next];
    setSequence(newSeq);
    const r = newSeq.length;
    setRound(r);
    if (r > bestRound) setBestRound(r);
    setMessage("Watch the sequence...");
    playSequence(newSeq);
  }, [sequence, bestRound, playSequence]);

  const handlePress = (idx: number) => {
    if (phase !== "input") return;

    // Flash
    setActiveIdx(idx);
    setTimeout(() => setActiveIdx(null), 200);

    const newInput = [...playerInput, idx];
    setPlayerInput(newInput);

    const step = newInput.length - 1;
    if (newInput[step] !== sequence[step]) {
      // Wrong
      setPhase("gameover");
      setMessage(`Wrong! You reached round ${round}.`);
      return;
    }

    if (newInput.length === sequence.length) {
      // Correct - next round
      setMessage("Correct! Get ready...");
      setPhase("showing");
      setTimeout(() => nextRound(), 1000);
    }
  };

  useEffect(() => {
    return () => clearTimeouts();
  }, []);

  return (
    <div className="flex flex-col items-center gap-5">
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Watch the Chinese elements light up, then repeat the pattern!
      </p>

      {/* Stats */}
      <div className="flex gap-6 text-center">
        <div>
          <div className="text-xs uppercase" style={{ color: "var(--muted)" }}>Round</div>
          <div className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>{round}</div>
        </div>
        <div>
          <div className="text-xs uppercase" style={{ color: "var(--muted)" }}>Best</div>
          <div className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>{bestRound}</div>
        </div>
      </div>

      {/* Character buttons */}
      <div className="grid grid-cols-3 gap-3">
        {CHARS.map((ch, idx) => {
          const isActive = activeIdx === idx;
          return (
            <button
              key={idx}
              onClick={() => handlePress(idx)}
              disabled={phase !== "input"}
              className="w-24 h-24 rounded-xl flex flex-col items-center justify-center gap-1 transition-all border-2"
              style={{
                backgroundColor: isActive ? ch.color : `${ch.color}30`,
                borderColor: ch.color,
                color: isActive ? "white" : ch.color,
                transform: isActive ? "scale(1.1)" : "scale(1)",
                boxShadow: isActive ? `0 0 20px ${ch.color}80` : "none",
              }}
            >
              <span className="text-3xl font-bold">{ch.char}</span>
              <span className="text-xs opacity-70">{ch.meaning}</span>
            </button>
          );
        })}
      </div>

      {/* Message */}
      {message && (
        <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
          {message}
        </div>
      )}

      {/* Progress dots */}
      {phase === "input" && (
        <div className="flex gap-1">
          {sequence.map((_, i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-full"
              style={{
                backgroundColor: i < playerInput.length ? "#22c55e" : "#d1d5db",
              }}
            />
          ))}
        </div>
      )}

      {(phase === "idle" || phase === "gameover") && (
        <button
          onClick={startGame}
          className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg"
        >
          {phase === "gameover" ? "Play Again" : "Start Game"}
        </button>
      )}

      {phase === "gameover" && (
        <div className="px-6 py-3 bg-red-500 text-white rounded-lg text-lg font-semibold">
          Game Over! Best: Round {bestRound}
        </div>
      )}
    </div>
  );
}
