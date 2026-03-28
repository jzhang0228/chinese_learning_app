"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const SIZE = 4;

const CHINESE_NUMS: Record<number, string> = {
  2: "二",
  4: "四",
  8: "八",
  16: "十六",
  32: "三十二",
  64: "六十四",
  128: "百",
  256: "二百",
  512: "五百",
  1024: "千",
  2048: "二千",
};

const TILE_COLORS: Record<number, string> = {
  2: "#eee4da",
  4: "#ede0c8",
  8: "#f2b179",
  16: "#f59563",
  32: "#f67c5f",
  64: "#f65e3b",
  128: "#edcf72",
  256: "#edcc61",
  512: "#edc850",
  1024: "#edc53f",
  2048: "#edc22e",
};

type Board = number[][];

function emptyBoard(): Board {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function addRandom(board: Board): Board {
  const b = board.map((r) => [...r]);
  const empty: [number, number][] = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) if (b[r][c] === 0) empty.push([r, c]);
  if (empty.length === 0) return b;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  b[r][c] = Math.random() < 0.9 ? 2 : 4;
  return b;
}

function slideRow(row: number[]): { newRow: number[]; score: number } {
  const nums = row.filter((n) => n !== 0);
  const result: number[] = [];
  let score = 0;
  let i = 0;
  while (i < nums.length) {
    if (i + 1 < nums.length && nums[i] === nums[i + 1]) {
      const merged = nums[i] * 2;
      result.push(merged);
      score += merged;
      i += 2;
    } else {
      result.push(nums[i]);
      i++;
    }
  }
  while (result.length < SIZE) result.push(0);
  return { newRow: result, score };
}

function moveLeft(board: Board): { board: Board; score: number; moved: boolean } {
  let totalScore = 0;
  let moved = false;
  const newBoard = board.map((row) => {
    const { newRow, score } = slideRow(row);
    totalScore += score;
    if (row.some((v, i) => v !== newRow[i])) moved = true;
    return newRow;
  });
  return { board: newBoard, score: totalScore, moved };
}

function rotate90(board: Board): Board {
  const b = emptyBoard();
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) b[c][SIZE - 1 - r] = board[r][c];
  return b;
}

function rotate270(board: Board): Board {
  return rotate90(rotate90(rotate90(board)));
}

function rotate180(board: Board): Board {
  return rotate90(rotate90(board));
}

function move(board: Board, direction: string): { board: Board; score: number; moved: boolean } {
  let b = board;
  let rotations = 0;
  if (direction === "up") { b = rotate270(b); rotations = 1; }
  else if (direction === "right") { b = rotate180(b); rotations = 2; }
  else if (direction === "down") { b = rotate90(b); rotations = 3; }

  const result = moveLeft(b);

  let rb = result.board;
  for (let i = 0; i < (4 - rotations) % 4; i++) rb = rotate90(rb);
  return { board: rb, score: result.score, moved: result.moved };
}

function canMove(board: Board): boolean {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === 0) return true;
      if (c + 1 < SIZE && board[r][c] === board[r][c + 1]) return true;
      if (r + 1 < SIZE && board[r][c] === board[r + 1][c]) return true;
    }
  return false;
}

export default function Game2048() {
  const [board, setBoard] = useState<Board>(emptyBoard);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const initGame = useCallback(() => {
    let b = emptyBoard();
    b = addRandom(b);
    b = addRandom(b);
    setBoard(b);
    setScore(0);
    setGameOver(false);
    setWon(false);
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const handleMove = useCallback(
    (direction: string) => {
      if (gameOver) return;
      const result = move(board, direction);
      if (!result.moved) return;

      const newBoard = addRandom(result.board);
      const newScore = score + result.score;
      setBoard(newBoard);
      setScore(newScore);
      if (newScore > best) setBest(newScore);

      if (!won && newBoard.some((row) => row.some((v) => v >= 2048))) {
        setWon(true);
      }
      if (!canMove(newBoard)) {
        setGameOver(true);
      }
    },
    [board, score, best, gameOver, won]
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const map: Record<string, string> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
      };
      if (map[e.key]) {
        e.preventDefault();
        handleMove(map[e.key]);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleMove]);

  const handleTouch = (e: React.TouchEvent, type: "start" | "end") => {
    if (type === "start") {
      touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (touchStart.current) {
      const dx = e.changedTouches[0].clientX - touchStart.current.x;
      const dy = e.changedTouches[0].clientY - touchStart.current.y;
      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        handleMove(dx > 0 ? "right" : "left");
      } else {
        handleMove(dy > 0 ? "down" : "up");
      }
      touchStart.current = null;
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Merge tiles to reach 2048! Learn Chinese numbers along the way.
      </p>

      <div className="flex gap-6 text-center">
        <div>
          <div className="text-xs uppercase" style={{ color: "var(--muted)" }}>Score</div>
          <div className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>{score}</div>
        </div>
        <div>
          <div className="text-xs uppercase" style={{ color: "var(--muted)" }}>Best</div>
          <div className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>{best}</div>
        </div>
      </div>

      <div
        className="rounded-xl p-3 inline-grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${SIZE}, 1fr)`,
          backgroundColor: "#bbada0",
          touchAction: "none",
        }}
        onTouchStart={(e) => handleTouch(e, "start")}
        onTouchEnd={(e) => handleTouch(e, "end")}
      >
        {board.flat().map((val, i) => (
          <div
            key={i}
            className="w-20 h-20 rounded-lg flex flex-col items-center justify-center font-bold transition-all"
            style={{
              backgroundColor: val ? TILE_COLORS[val] || "#3c3a32" : "#cdc1b4",
              color: val > 4 ? "#f9f6f2" : "#776e65",
            }}
          >
            {val > 0 && (
              <>
                <span className="text-xl leading-tight">{CHINESE_NUMS[val] || val}</span>
                <span className="text-xs opacity-60">{val}</span>
              </>
            )}
          </div>
        ))}
      </div>

      {won && !gameOver && (
        <div className="px-6 py-3 bg-green-500 text-white rounded-lg text-lg font-semibold">
          You reached 2048!
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
