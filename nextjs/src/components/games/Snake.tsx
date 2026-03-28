"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const GRID = 15;
const TICK = 150;

const FOOD_CHARS = [
  { char: "龙", pinyin: "dragon" },
  { char: "虎", pinyin: "tiger" },
  { char: "鱼", pinyin: "fish" },
  { char: "鸟", pinyin: "bird" },
  { char: "花", pinyin: "flower" },
  { char: "月", pinyin: "moon" },
  { char: "星", pinyin: "star" },
  { char: "风", pinyin: "wind" },
  { char: "雨", pinyin: "rain" },
  { char: "雪", pinyin: "snow" },
];

type Pos = [number, number];
type Dir = [number, number];

const DIRS: Record<string, Dir> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

export default function Snake() {
  const [snake, setSnake] = useState<Pos[]>([[7, 7]]);
  const [food, setFood] = useState<Pos>([3, 3]);
  const [foodChar, setFoodChar] = useState(FOOD_CHARS[0]);
  const [dir, setDir] = useState<Dir>([1, 0]);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [started, setStarted] = useState(false);
  const [collected, setCollected] = useState<{ char: string; pinyin: string }[]>([]);
  const dirRef = useRef<Dir>([1, 0]);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const placeFood = useCallback((snakeBody: Pos[]): [Pos, typeof FOOD_CHARS[0]] => {
    const occupied = new Set(snakeBody.map(([x, y]) => `${x},${y}`));
    let pos: Pos;
    do {
      pos = [Math.floor(Math.random() * GRID), Math.floor(Math.random() * GRID)];
    } while (occupied.has(`${pos[0]},${pos[1]}`));
    const char = FOOD_CHARS[Math.floor(Math.random() * FOOD_CHARS.length)];
    return [pos, char];
  }, []);

  const initGame = useCallback(() => {
    const s: Pos[] = [[7, 7]];
    setSnake(s);
    setDir([1, 0]);
    dirRef.current = [1, 0];
    setGameOver(false);
    setScore(0);
    setStarted(false);
    setCollected([]);
    const [fp, fc] = placeFood(s);
    setFood(fp);
    setFoodChar(fc);
  }, [placeFood]);

  useEffect(() => {
    initGame();
  }, [initGame]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const d = DIRS[e.key];
      if (d) {
        e.preventDefault();
        // Prevent reversing
        if (d[0] !== -dirRef.current[0] || d[1] !== -dirRef.current[1]) {
          dirRef.current = d;
          setDir(d);
          if (!started) setStarted(true);
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [started]);

  useEffect(() => {
    if (!started || gameOver) return;

    const interval = setInterval(() => {
      setSnake((prev) => {
        const d = dirRef.current;
        const head: Pos = [prev[0][0] + d[0], prev[0][1] + d[1]];

        // Wall collision
        if (head[0] < 0 || head[0] >= GRID || head[1] < 0 || head[1] >= GRID) {
          setGameOver(true);
          return prev;
        }
        // Self collision
        if (prev.some(([x, y]) => x === head[0] && y === head[1])) {
          setGameOver(true);
          return prev;
        }

        const newSnake = [head, ...prev];
        if (head[0] === food[0] && head[1] === food[1]) {
          setScore((s) => s + 1);
          setCollected((c) => [...c, foodChar]);
          const [fp, fc] = placeFood(newSnake);
          setFood(fp);
          setFoodChar(fc);
        } else {
          newSnake.pop();
        }
        return newSnake;
      });
    }, TICK);

    return () => clearInterval(interval);
  }, [started, gameOver, food, foodChar, placeFood]);

  const handleTouch = (e: React.TouchEvent, type: "start" | "end") => {
    if (type === "start") {
      touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (touchStart.current) {
      const dx = e.changedTouches[0].clientX - touchStart.current.x;
      const dy = e.changedTouches[0].clientY - touchStart.current.y;
      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
      let nd: Dir;
      if (Math.abs(dx) > Math.abs(dy)) {
        nd = dx > 0 ? [1, 0] : [-1, 0];
      } else {
        nd = dy > 0 ? [0, 1] : [0, -1];
      }
      if (nd[0] !== -dirRef.current[0] || nd[1] !== -dirRef.current[1]) {
        dirRef.current = nd;
        setDir(nd);
        if (!started) setStarted(true);
      }
      touchStart.current = null;
    }
  };

  const cellSize = 28;

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        {started ? "Collect the characters!" : "Press arrow keys or swipe to start"}
      </p>
      <p className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
        Score: {score}
      </p>

      <div
        className="relative border-2 rounded-lg overflow-hidden"
        style={{
          width: GRID * cellSize,
          height: GRID * cellSize,
          borderColor: "var(--card-border)",
          backgroundColor: "#f0f4e8",
          touchAction: "none",
        }}
        onTouchStart={(e) => handleTouch(e, "start")}
        onTouchEnd={(e) => handleTouch(e, "end")}
      >
        {/* Food */}
        <div
          className="absolute flex items-center justify-center text-lg"
          style={{
            left: food[0] * cellSize,
            top: food[1] * cellSize,
            width: cellSize,
            height: cellSize,
          }}
        >
          {foodChar.char}
        </div>

        {/* Snake */}
        {snake.map(([x, y], i) => (
          <div
            key={i}
            className="absolute rounded-sm"
            style={{
              left: x * cellSize + 1,
              top: y * cellSize + 1,
              width: cellSize - 2,
              height: cellSize - 2,
              backgroundColor: i === 0 ? "#16a34a" : "#4ade80",
            }}
          />
        ))}
      </div>

      {/* Collected characters */}
      {collected.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center max-w-[420px]">
          {collected.map((c, i) => (
            <span
              key={i}
              className="px-2 py-1 rounded text-sm"
              style={{ backgroundColor: "var(--primary-light)", color: "var(--primary)" }}
            >
              {c.char} <span className="text-xs opacity-70">{c.pinyin}</span>
            </span>
          ))}
        </div>
      )}

      {gameOver && (
        <div className="flex flex-col items-center gap-3">
          <div className="px-6 py-3 bg-red-500 text-white rounded-lg text-lg font-semibold">
            Game Over! Score: {score}
          </div>
          <button
            onClick={initGame}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Play Again
          </button>
        </div>
      )}
    </div>
  );
}
