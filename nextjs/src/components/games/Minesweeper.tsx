"use client";

import { useState, useEffect, useCallback } from "react";

const ROWS = 8;
const COLS = 8;
const MINES = 10;

const NUMBER_COLORS: Record<number, string> = {
  1: "blue",
  2: "green",
  3: "red",
  4: "darkblue",
  5: "darkred",
  6: "teal",
  7: "black",
  8: "gray",
};

interface Cell {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  adjacent: number;
}

export default function Minesweeper() {
  const [grid, setGrid] = useState<Cell[][]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [flagMode, setFlagMode] = useState(false);
  const [firstClick, setFirstClick] = useState(true);
  const [mineCount, setMineCount] = useState(MINES);
  const [flagCount, setFlagCount] = useState(0);

  const createEmptyGrid = useCallback((): Cell[][] => {
    return Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => ({
        mine: false,
        revealed: false,
        flagged: false,
        adjacent: 0,
      }))
    );
  }, []);

  const initGame = useCallback(() => {
    setGrid(createEmptyGrid());
    setGameOver(false);
    setWon(false);
    setFlagMode(false);
    setFirstClick(true);
    setMineCount(MINES);
    setFlagCount(0);
  }, [createEmptyGrid]);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const placeMines = (g: Cell[][], safeR: number, safeC: number) => {
    let placed = 0;
    while (placed < MINES) {
      const r = Math.floor(Math.random() * ROWS);
      const c = Math.floor(Math.random() * COLS);
      if (g[r][c].mine) continue;
      if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;
      g[r][c].mine = true;
      placed++;
    }
    // Calculate adjacency
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (g[r][c].mine) continue;
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && g[nr][nc].mine) {
              count++;
            }
          }
        }
        g[r][c].adjacent = count;
      }
    }
  };

  const floodReveal = (g: Cell[][], r: number, c: number) => {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
    if (g[r][c].revealed || g[r][c].flagged || g[r][c].mine) return;
    g[r][c].revealed = true;
    if (g[r][c].adjacent === 0) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          floodReveal(g, r + dr, c + dc);
        }
      }
    }
  };

  const checkWin = (g: Cell[][]): boolean => {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!g[r][c].mine && !g[r][c].revealed) return false;
      }
    }
    return true;
  };

  const handleClick = (r: number, c: number) => {
    if (gameOver || won) return;
    const newGrid = grid.map((row) => row.map((cell) => ({ ...cell })));

    if (flagMode) {
      if (newGrid[r][c].revealed) return;
      newGrid[r][c].flagged = !newGrid[r][c].flagged;
      const fc = newGrid.flat().filter((c) => c.flagged).length;
      setFlagCount(fc);
      setGrid(newGrid);
      return;
    }

    if (newGrid[r][c].flagged) return;

    if (firstClick) {
      placeMines(newGrid, r, c);
      setFirstClick(false);
    }

    if (newGrid[r][c].mine) {
      // Reveal all mines
      for (let i = 0; i < ROWS; i++) {
        for (let j = 0; j < COLS; j++) {
          if (newGrid[i][j].mine) newGrid[i][j].revealed = true;
        }
      }
      setGrid(newGrid);
      setGameOver(true);
      return;
    }

    floodReveal(newGrid, r, c);
    setGrid(newGrid);

    if (checkWin(newGrid)) {
      setWon(true);
    }
  };

  if (grid.length === 0) return <div>Loading...</div>;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-4 items-center text-gray-700">
        <span>Mines: {mineCount}</span>
        <span>Flags: {flagCount}</span>
        <button
          onClick={() => setFlagMode(!flagMode)}
          className={`px-4 py-1 rounded-lg border-2 transition-colors ${
            flagMode
              ? "bg-red-500 text-white border-red-600"
              : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
          }`}
        >
          {flagMode ? "Flag Mode ON" : "Flag Mode OFF"}
        </button>
      </div>

      <div
        className="inline-grid gap-0 border-2 border-gray-400"
        style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
      >
        {grid.map((row, r) =>
          row.map((cell, c) => (
            <button
              key={`${r}-${c}`}
              onClick={() => handleClick(r, c)}
              className={`w-10 h-10 text-sm font-bold border border-gray-300 transition-colors ${
                cell.revealed
                  ? cell.mine
                    ? "bg-red-400"
                    : "bg-gray-200"
                  : "bg-gray-400 hover:bg-gray-350 cursor-pointer"
              }`}
              style={{
                color: cell.revealed && !cell.mine ? NUMBER_COLORS[cell.adjacent] || "black" : undefined,
              }}
            >
              {cell.flagged && !cell.revealed
                ? "🚩"
                : cell.revealed
                ? cell.mine
                  ? "💣"
                  : cell.adjacent > 0
                  ? cell.adjacent
                  : ""
                : ""}
            </button>
          ))
        )}
      </div>

      {gameOver && (
        <div className="px-6 py-3 bg-red-500 text-white rounded-lg text-lg font-semibold">
          Game Over! You hit a mine.
        </div>
      )}
      {won && (
        <div className="px-6 py-3 bg-green-500 text-white rounded-lg text-lg font-semibold">
          You win! All safe cells revealed.
        </div>
      )}

    </div>
  );
}
