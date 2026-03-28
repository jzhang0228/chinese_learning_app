"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import ReviewResults from "@/components/ReviewResults";

interface Word {
  chinese: string;
  english: string;
  pinyin: string;
}

interface FallingTile {
  id: number;
  word: string;
  x: number;
  y: number;
  speed: number;
  exploding: boolean;
  explodeFrame: number;
}

export default function SkyDropPage() {
  const router = useRouter();
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Game state
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [youWin, setYouWin] = useState(false);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [speed, setSpeed] = useState(1);
  const [micStatus, setMicStatus] = useState("Initializing...");

  const tilesRef = useRef<FallingTile[]>([]);
  const [tiles, setTiles] = useState<FallingTile[]>([]);
  const nextIdRef = useRef(0);
  const spawnCountRef = useRef<Record<string, number>>({});
  const totalSpawnedRef = useRef(0);
  const totalToSpawnRef = useRef(0);
  const destroyedCountRef = useRef(0);
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const speedRef = useRef(1);
  const gameOverRef = useRef(false);
  const animFrameRef = useRef<number>(0);
  const lastSpawnRef = useRef(0);
  const recognitionRef = useRef<ReturnType<typeof createRecognition> | null>(null);
  const wordsRef = useRef<Word[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const destroyedWordsRef = useRef<Set<string>>(new Set());
  const missedWordsRef = useRef<Set<string>>(new Set());
  const [results, setResults] = useState<{ won: Word[]; lost: Word[] } | null>(null);

  // Fetch words
  useEffect(() => {
    const fetchWords = async () => {
      try {
        const res = await fetch("/api/words");
        if (!res.ok) throw new Error("Failed to fetch words");
        const data = await res.json();
        const raw: Word[] = (data.words || data);
        const seen = new Set<string>();
        const w: Word[] = raw.filter((word) => {
          if (seen.has(word.chinese)) return false;
          seen.add(word.chinese);
          return true;
        }).slice(0, 30);
        if (w.length === 0) {
          setError("No learned words found. Learn some words first!");
          setLoading(false);
          return;
        }
        setWords(w);
        wordsRef.current = w;
        setLoading(false);
      } catch {
        setError("Could not load words.");
        setLoading(false);
      }
    };
    fetchWords();
  }, []);

  function createRecognition() {
    const SpeechRecognition =
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new (SpeechRecognition as any)();
    rec.continuous = true;
    rec.lang = "zh-CN";
    rec.interimResults = true;
    return rec;
  }

  const destroyTile = useCallback((tileId: number) => {
    const tile = tilesRef.current.find((t) => t.id === tileId);
    if (tile) destroyedWordsRef.current.add(tile.word);
    tilesRef.current = tilesRef.current.map((t) =>
      t.id === tileId ? { ...t, exploding: true, explodeFrame: 0 } : t
    );
    destroyedCountRef.current++;
    scoreRef.current++;
    setScore(scoreRef.current);

    // Increase speed every 5 points
    if (scoreRef.current % 5 === 0) {
      speedRef.current = Math.min(speedRef.current + 0.3, 4);
      setSpeed(speedRef.current);
    }
  }, []);

  const buildResults = useCallback(() => {
    const wordMap = new Map(wordsRef.current.map((w) => [w.chinese, w]));
    const won: Word[] = [];
    const lost: Word[] = [];
    for (const [chinese, word] of wordMap) {
      if (missedWordsRef.current.has(chinese)) {
        lost.push(word);
      } else if (destroyedWordsRef.current.has(chinese)) {
        won.push(word);
      }
    }
    setResults({ won, lost });
  }, []);

  const startGame = useCallback(() => {
    if (wordsRef.current.length === 0) return;

    setGameStarted(true);
    setGameOver(false);
    setYouWin(false);
    setScore(0);
    setLives(3);
    setSpeed(1);
    scoreRef.current = 0;
    livesRef.current = 3;
    speedRef.current = 1;
    gameOverRef.current = false;
    tilesRef.current = [];
    nextIdRef.current = 0;
    destroyedCountRef.current = 0;
    totalSpawnedRef.current = 0;
    lastSpawnRef.current = 0;
    destroyedWordsRef.current = new Set();
    missedWordsRef.current = new Set();
    setResults(null);
    spawnCountRef.current = {};
    wordsRef.current.forEach((w) => {
      spawnCountRef.current[w.chinese] = 0;
    });
    totalToSpawnRef.current = wordsRef.current.length * 2;

    // Start speech recognition
    const rec = createRecognition();
    if (rec) {
      recognitionRef.current = rec;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          // Check each CJK character in transcript against active tiles
          for (const char of transcript) {
            if (/[\u4e00-\u9fff]/.test(char)) {
              const matchTile = tilesRef.current.find(
                (t) => !t.exploding && t.word.includes(char)
              );
              if (matchTile) {
                destroyTile(matchTile.id);
              }
            }
          }
        }
      };
      rec.onerror = () => {
        setMicStatus("Mic error - retrying...");
      };
      rec.onend = () => {
        if (!gameOverRef.current) {
          try {
            rec.start();
          } catch {
            // ignore
          }
        }
      };
      try {
        rec.start();
        setMicStatus("Listening...");
      } catch {
        setMicStatus("Could not start mic");
      }
    } else {
      setMicStatus("Speech API not supported");
    }

    // Game loop
    const containerHeight = containerRef.current?.clientHeight || 600;
    const groundY = containerHeight - 60;

    const spawnTile = () => {
      if (totalSpawnedRef.current >= totalToSpawnRef.current) return;
      const available = wordsRef.current.filter(
        (w) => (spawnCountRef.current[w.chinese] || 0) < 2
      );
      if (available.length === 0) return;
      const word = available[Math.floor(Math.random() * available.length)];
      spawnCountRef.current[word.chinese] = (spawnCountRef.current[word.chinese] || 0) + 1;
      totalSpawnedRef.current++;

      const containerWidth = containerRef.current?.clientWidth || 400;
      const tile: FallingTile = {
        id: nextIdRef.current++,
        word: word.chinese,
        x: 40 + Math.random() * (containerWidth - 140),
        y: -40,
        speed: 0.5 + speedRef.current * 0.4,
        exploding: false,
        explodeFrame: 0,
      };
      tilesRef.current.push(tile);
    };

    let lastTime = 0;
    const loop = (time: number) => {
      if (gameOverRef.current) return;

      const delta = lastTime === 0 ? 16 : time - lastTime;
      lastTime = time;

      // Spawn every 1.5-2.5 seconds
      if (time - lastSpawnRef.current > 1500 + Math.random() * 1000) {
        spawnTile();
        lastSpawnRef.current = time;
      }

      // Update tiles
      tilesRef.current = tilesRef.current
        .map((t) => {
          if (t.exploding) {
            return { ...t, explodeFrame: t.explodeFrame + 1 };
          }
          return { ...t, y: t.y + t.speed * (delta / 16) };
        })
        .filter((t) => {
          if (t.exploding && t.explodeFrame > 20) return false;
          if (!t.exploding && t.y > groundY) {
            // Hit ground
            missedWordsRef.current.add(t.word);
            livesRef.current--;
            setLives(livesRef.current);
            if (livesRef.current <= 0) {
              gameOverRef.current = true;
              setGameOver(true);
              buildResults();
              if (recognitionRef.current) {
                try {
                  recognitionRef.current.stop();
                } catch {
                  // ignore
                }
              }
            }
            return false;
          }
          return true;
        });

      setTiles([...tilesRef.current]);

      // Check win
      if (
        totalSpawnedRef.current >= totalToSpawnRef.current &&
        tilesRef.current.filter((t) => !t.exploding).length === 0 &&
        livesRef.current > 0
      ) {
        gameOverRef.current = true;
        setYouWin(true);
        buildResults();
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch {
            // ignore
          }
        }
        return;
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      gameOverRef.current = true;
      cancelAnimationFrame(animFrameRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, [destroyTile]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      gameOverRef.current = true;
      cancelAnimationFrame(animFrameRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center text-white text-xl"
        style={{ background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)" }}
      >
        Loading words...
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4 text-white px-4"
        style={{ background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)" }}
      >
        <p className="text-red-400 text-lg">{error}</p>
        <button
          onClick={() => router.push("/")}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Home
        </button>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)" }}
    >
      {/* Top bar */}
      <div className="flex justify-between items-center px-4 py-3 z-10">
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors backdrop-blur"
        >
          Home
        </button>
        <div className="flex gap-4 text-white items-center">
          {/* Hearts */}
          <span className="text-lg">
            {Array.from({ length: 3 }, (_, i) => (
              <span key={i} style={{ opacity: i < lives ? 1 : 0.3 }}>
                &#10084;&#65039;
              </span>
            ))}
          </span>
          <span className="font-semibold">Score: {score}</span>
          <span className="text-sm bg-white/20 px-2 py-1 rounded">
            Speed: {speed.toFixed(1)}x
          </span>
        </div>
      </div>

      {/* Game area */}
      <div
        ref={containerRef}
        className="flex-1 relative"
        style={{ minHeight: 500 }}
      >
        {!gameStarted && !gameOver && !youWin && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 z-10">
            <h1 className="text-4xl font-bold text-white">Sky Drop</h1>
            <p className="text-white/70 text-center max-w-md px-4">
              Chinese words fall from the sky. Speak the word to destroy it before it hits the ground!
            </p>
            <button
              onClick={startGame}
              className="px-8 py-3 bg-green-500 text-white text-xl rounded-xl hover:bg-green-600 transition-colors font-bold"
            >
              Start Game
            </button>
          </div>
        )}

        {/* Falling tiles */}
        {tiles.map((tile) => (
          <div
            key={tile.id}
            style={{
              position: "absolute",
              left: tile.x,
              top: tile.y,
              transform: tile.exploding
                ? `scale(${1 + tile.explodeFrame * 0.1}) rotate(${tile.explodeFrame * 10}deg)`
                : "none",
              opacity: tile.exploding ? Math.max(0, 1 - tile.explodeFrame / 20) : 1,
              transition: "none",
              background: tile.exploding
                ? "radial-gradient(circle, #ff6b35, #ff4500, transparent)"
                : "rgba(255, 255, 255, 0.15)",
              border: tile.exploding ? "none" : "1px solid rgba(255, 255, 255, 0.3)",
              borderRadius: tile.exploding ? "50%" : "8px",
              padding: tile.exploding ? "16px" : "8px 16px",
              backdropFilter: tile.exploding ? "none" : "blur(10px)",
              color: "white",
              fontSize: "20px",
              fontWeight: "bold",
              whiteSpace: "nowrap",
              pointerEvents: "none",
              zIndex: tile.exploding ? 20 : 10,
              width: tile.exploding ? "60px" : "auto",
              height: tile.exploding ? "60px" : "auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {tile.exploding ? "💥" : tile.word}
          </div>
        ))}

        {/* Ground line */}
        <div
          style={{
            position: "absolute",
            bottom: 60,
            left: 0,
            right: 0,
            height: 3,
            background: "rgba(255, 60, 60, 0.7)",
            boxShadow: "0 0 10px rgba(255, 60, 60, 0.5)",
          }}
        />

        {/* Game Over overlay */}
        {gameOver && (
          <div className="absolute inset-0 z-20 bg-black/80 overflow-y-auto">
            <div className="flex flex-col items-center py-12 px-4 min-h-full">
              <h2 className="text-5xl font-bold text-red-400 mb-4">Game Over</h2>
              <p className="text-white text-xl mb-6">Final Score: {score}</p>
              {results && <ReviewResults won={results.won} lost={results.lost} />}
              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => {
                    setGameStarted(false);
                    setGameOver(false);
                    setTiles([]);
                    setResults(null);
                  }}
                  className="px-6 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 text-lg font-semibold"
                >
                  Try Again
                </button>
                <button
                  onClick={() => router.push("/")}
                  className="px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 text-lg font-semibold"
                >
                  Home
                </button>
              </div>
            </div>
          </div>
        )}

        {/* You Win overlay */}
        {youWin && (
          <div className="absolute inset-0 z-20 bg-black/80 overflow-y-auto">
            <div className="flex flex-col items-center py-12 px-4 min-h-full">
              <h2 className="text-5xl font-bold text-green-400 mb-4">You Win!</h2>
              <p className="text-white text-xl mb-6">Score: {score}</p>
              {results && <ReviewResults won={results.won} lost={results.lost} />}
              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => {
                    setGameStarted(false);
                    setYouWin(false);
                    setTiles([]);
                    setResults(null);
                  }}
                  className="px-6 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 text-lg font-semibold"
                >
                  Play Again
                </button>
                <button
                  onClick={() => router.push("/")}
                  className="px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 text-lg font-semibold"
                >
                  Home
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mic status bar */}
      {gameStarted && !gameOver && !youWin && (
        <div
          className="px-4 py-2 text-center text-white/80 text-sm"
          style={{ background: "rgba(0,0,0,0.3)" }}
        >
          Mic: {micStatus}
        </div>
      )}
    </div>
  );
}
