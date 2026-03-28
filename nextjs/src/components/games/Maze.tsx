"use client";

import { useState, useEffect, useCallback } from "react";

const CELL = 40;

const QUIZ_CHARS = [
  { char: "一", pinyin: "yi", meaning: "one" },
  { char: "二", pinyin: "er", meaning: "two" },
  { char: "三", pinyin: "san", meaning: "three" },
  { char: "四", pinyin: "si", meaning: "four" },
  { char: "五", pinyin: "wu", meaning: "five" },
  { char: "六", pinyin: "liu", meaning: "six" },
  { char: "七", pinyin: "qi", meaning: "seven" },
  { char: "八", pinyin: "ba", meaning: "eight" },
  { char: "九", pinyin: "jiu", meaning: "nine" },
  { char: "十", pinyin: "shi", meaning: "ten" },
];

type Cell = { top: boolean; right: boolean; bottom: boolean; left: boolean };

function generateMaze(rows: number, cols: number): Cell[][] {
  const maze: Cell[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ top: true, right: true, bottom: true, left: true }))
  );

  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
  const stack: [number, number][] = [[0, 0]];
  visited[0][0] = true;

  while (stack.length > 0) {
    const [r, c] = stack[stack.length - 1];
    const neighbors: [number, number, string, string][] = [];

    if (r > 0 && !visited[r - 1][c]) neighbors.push([r - 1, c, "top", "bottom"]);
    if (r < rows - 1 && !visited[r + 1][c]) neighbors.push([r + 1, c, "bottom", "top"]);
    if (c > 0 && !visited[r][c - 1]) neighbors.push([r, c - 1, "left", "right"]);
    if (c < cols - 1 && !visited[r][c + 1]) neighbors.push([r, c + 1, "right", "left"]);

    if (neighbors.length === 0) {
      stack.pop();
    } else {
      const [nr, nc, wall, opposite] = neighbors[Math.floor(Math.random() * neighbors.length)];
      (maze[r][c] as Record<string, boolean>)[wall] = false;
      (maze[nr][nc] as Record<string, boolean>)[opposite] = false;
      visited[nr][nc] = true;
      stack.push([nr, nc]);
    }
  }
  return maze;
}

const ROWS = 8;
const COLS = 8;

export default function Maze() {
  const [maze, setMaze] = useState<Cell[][]>([]);
  const [pos, setPos] = useState<[number, number]>([0, 0]);
  const [won, setWon] = useState(false);
  const [steps, setSteps] = useState(0);
  const [quiz, setQuiz] = useState<{ char: typeof QUIZ_CHARS[0]; options: string[] } | null>(null);
  const [pendingMove, setPendingMove] = useState<[number, number] | null>(null);
  const [collected, setCollected] = useState<string[]>([]);
  const [quizCells, setQuizCells] = useState<Set<string>>(new Set());

  const initGame = useCallback(() => {
    const m = generateMaze(ROWS, COLS);
    setMaze(m);
    setPos([0, 0]);
    setWon(false);
    setSteps(0);
    setQuiz(null);
    setPendingMove(null);
    setCollected([]);
    // Place quiz triggers on random cells
    const cells = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const r = Math.floor(Math.random() * ROWS);
      const c = Math.floor(Math.random() * COLS);
      if (r === 0 && c === 0) continue;
      if (r === ROWS - 1 && c === COLS - 1) continue;
      cells.add(`${r},${c}`);
    }
    setQuizCells(cells);
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const tryMove = useCallback(
    (dr: number, dc: number) => {
      if (won || quiz) return;
      const [r, c] = pos;
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return;

      // Check walls
      const cell = maze[r][c];
      if (dr === -1 && cell.top) return;
      if (dr === 1 && cell.bottom) return;
      if (dc === -1 && cell.left) return;
      if (dc === 1 && cell.right) return;

      const key = `${nr},${nc}`;
      if (quizCells.has(key)) {
        // Trigger quiz
        const q = QUIZ_CHARS[Math.floor(Math.random() * QUIZ_CHARS.length)];
        const wrong = QUIZ_CHARS.filter((c) => c.meaning !== q.meaning)
          .sort(() => Math.random() - 0.5)
          .slice(0, 3)
          .map((c) => c.meaning);
        const options = [...wrong, q.meaning].sort(() => Math.random() - 0.5);
        setQuiz({ char: q, options });
        setPendingMove([nr, nc]);
        return;
      }

      setPos([nr, nc]);
      setSteps((s) => s + 1);
      if (nr === ROWS - 1 && nc === COLS - 1) setWon(true);
    },
    [pos, maze, won, quiz, quizCells]
  );

  const handleQuizAnswer = (answer: string) => {
    if (!quiz || !pendingMove) return;
    if (answer === quiz.char.meaning) {
      setCollected((c) => [...c, quiz.char.char]);
      const key = `${pendingMove[0]},${pendingMove[1]}`;
      setQuizCells((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      setPos(pendingMove);
      setSteps((s) => s + 1);
      if (pendingMove[0] === ROWS - 1 && pendingMove[1] === COLS - 1) setWon(true);
    }
    // Wrong answer just dismisses the quiz, doesn't move
    setQuiz(null);
    setPendingMove(null);
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const map: Record<string, [number, number]> = {
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0],
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1],
      };
      if (map[e.key]) {
        e.preventDefault();
        tryMove(...map[e.key]);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [tryMove]);

  if (maze.length === 0) return <div>Loading...</div>;

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Navigate to the bottom-right corner! Answer character quizzes along the way.
      </p>
      <p className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
        Steps: {steps}
      </p>

      {/* Maze grid */}
      <div className="relative" style={{ width: COLS * CELL, height: ROWS * CELL }}>
        {maze.map((row, r) =>
          row.map((cell, c) => (
            <div
              key={`${r}-${c}`}
              className="absolute"
              style={{
                left: c * CELL,
                top: r * CELL,
                width: CELL,
                height: CELL,
                borderTop: cell.top ? "2px solid #374151" : "2px solid transparent",
                borderRight: cell.right ? "2px solid #374151" : "2px solid transparent",
                borderBottom: cell.bottom ? "2px solid #374151" : "2px solid transparent",
                borderLeft: cell.left ? "2px solid #374151" : "2px solid transparent",
                backgroundColor:
                  r === pos[0] && c === pos[1]
                    ? "#3b82f6"
                    : r === ROWS - 1 && c === COLS - 1
                    ? "#86efac"
                    : quizCells.has(`${r},${c}`)
                    ? "#fef08a"
                    : "#f9fafb",
              }}
            >
              {r === pos[0] && c === pos[1] && (
                <div className="w-full h-full flex items-center justify-center text-white text-sm font-bold">
                  &#x25CF;
                </div>
              )}
              {quizCells.has(`${r},${c}`) && !(r === pos[0] && c === pos[1]) && (
                <div className="w-full h-full flex items-center justify-center text-amber-600 text-xs">
                  ?
                </div>
              )}
              {r === ROWS - 1 && c === COLS - 1 && !(r === pos[0] && c === pos[1]) && (
                <div className="w-full h-full flex items-center justify-center text-green-600 text-sm">
                  &#x2605;
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Mobile controls */}
      <div className="grid grid-cols-3 gap-1 w-32 md:hidden">
        <div />
        <button onClick={() => tryMove(-1, 0)} className="bg-gray-200 rounded p-2 text-center font-bold">&#x25B2;</button>
        <div />
        <button onClick={() => tryMove(0, -1)} className="bg-gray-200 rounded p-2 text-center font-bold">&#x25C0;</button>
        <div />
        <button onClick={() => tryMove(0, 1)} className="bg-gray-200 rounded p-2 text-center font-bold">&#x25B6;</button>
        <div />
        <button onClick={() => tryMove(1, 0)} className="bg-gray-200 rounded p-2 text-center font-bold">&#x25BC;</button>
        <div />
      </div>

      {/* Quiz modal */}
      {quiz && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl flex flex-col items-center gap-4 max-w-sm">
            <p className="text-sm text-gray-500">What does this character mean?</p>
            <div className="text-5xl">{quiz.char.char}</div>
            <div className="text-sm text-gray-400">{quiz.char.pinyin}</div>
            <div className="grid grid-cols-2 gap-2 w-full">
              {quiz.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => handleQuizAnswer(opt)}
                  className="px-4 py-3 bg-blue-100 rounded-lg hover:bg-blue-200 text-blue-800 font-medium transition-colors"
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Collected */}
      {collected.length > 0 && (
        <div className="flex gap-2">
          {collected.map((ch, i) => (
            <span
              key={i}
              className="px-2 py-1 rounded text-lg"
              style={{ backgroundColor: "var(--primary-light)", color: "var(--primary)" }}
            >
              {ch}
            </span>
          ))}
        </div>
      )}

      {won && (
        <div className="flex flex-col items-center gap-3">
          <div className="px-6 py-3 bg-green-500 text-white rounded-lg text-lg font-semibold">
            You escaped in {steps} steps!
          </div>
          <button
            onClick={initGame}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            New Maze
          </button>
        </div>
      )}
    </div>
  );
}
