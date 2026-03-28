"use client";

import { useState, useEffect, useCallback } from "react";

export default function LightsOut() {
  const [grid, setGrid] = useState<boolean[][]>([]);
  const [won, setWon] = useState(false);
  const [lightCount, setLightCount] = useState(0);

  const initGame = useCallback(() => {
    const board = Array.from({ length: 5 }, () => Array(5).fill(false));

    const toggle = (b: boolean[][], r: number, c: number) => {
      const dirs = [
        [0, 0],
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ];
      for (const [dr, dc] of dirs) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < 5 && nc >= 0 && nc < 5) {
          b[nr][nc] = !b[nr][nc];
        }
      }
    };

    const numToggles = 8 + Math.floor(Math.random() * 7); // 8-14
    for (let i = 0; i < numToggles; i++) {
      const r = Math.floor(Math.random() * 5);
      const c = Math.floor(Math.random() * 5);
      toggle(board, r, c);
    }

    setGrid(board);
    setWon(false);
    setLightCount(board.flat().filter(Boolean).length);
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const handleClick = (r: number, c: number) => {
    if (won) return;
    const newGrid = grid.map((row) => [...row]);
    const dirs = [
      [0, 0],
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    for (const [dr, dc] of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < 5 && nc >= 0 && nc < 5) {
        newGrid[nr][nc] = !newGrid[nr][nc];
      }
    }
    setGrid(newGrid);

    const count = newGrid.flat().filter(Boolean).length;
    setLightCount(count);
    if (count === 0) {
      setWon(true);
    }
  };

  if (grid.length === 0) return <div>Loading...</div>;

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-gray-600 text-sm">
        Turn off all the lights! Clicking a cell toggles it and its neighbors.
      </p>
      <p className="text-lg font-semibold text-gray-700">
        Lights on: {lightCount}
      </p>

      <div
        className="inline-grid gap-1"
        style={{ gridTemplateColumns: "repeat(5, 1fr)" }}
      >
        {grid.map((row, r) =>
          row.map((on, c) => (
            <button
              key={`${r}-${c}`}
              onClick={() => handleClick(r, c)}
              className={`w-16 h-16 rounded-md transition-all border-2 ${
                on
                  ? "bg-yellow-400 border-yellow-500 shadow-lg shadow-yellow-300"
                  : "bg-gray-700 border-gray-600"
              }`}
            />
          ))
        )}
      </div>

      {won && (
        <div className="px-6 py-3 bg-green-500 text-white rounded-lg text-lg font-semibold">
          All lights are off! You win!
        </div>
      )}

      <button
        onClick={initGame}
        className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
      >
        New Game
      </button>
    </div>
  );
}
