"use client";

import { useState, useEffect, useCallback } from "react";

export default function SlidingPuzzle() {
  const [tiles, setTiles] = useState<number[]>([]);
  const [won, setWon] = useState(false);

  const initGame = useCallback(() => {
    const solved = [1, 2, 3, 4, 5, 6, 7, 8, 0];
    const board = [...solved];

    // Shuffle by making 300 random moves from solved state
    let blankIdx = 8;
    for (let i = 0; i < 300; i++) {
      const row = Math.floor(blankIdx / 3);
      const col = blankIdx % 3;
      const neighbors: number[] = [];
      if (row > 0) neighbors.push(blankIdx - 3);
      if (row < 2) neighbors.push(blankIdx + 3);
      if (col > 0) neighbors.push(blankIdx - 1);
      if (col < 2) neighbors.push(blankIdx + 1);
      const pick = neighbors[Math.floor(Math.random() * neighbors.length)];
      [board[blankIdx], board[pick]] = [board[pick], board[blankIdx]];
      blankIdx = pick;
    }

    setTiles(board);
    setWon(false);
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const checkWin = (board: number[]) => {
    const solved = [1, 2, 3, 4, 5, 6, 7, 8, 0];
    return board.every((v, i) => v === solved[i]);
  };

  const handleClick = (idx: number) => {
    if (won) return;
    const blankIdx = tiles.indexOf(0);
    const row = Math.floor(idx / 3);
    const col = idx % 3;
    const blankRow = Math.floor(blankIdx / 3);
    const blankCol = blankIdx % 3;

    const isAdjacent =
      (Math.abs(row - blankRow) === 1 && col === blankCol) ||
      (Math.abs(col - blankCol) === 1 && row === blankRow);

    if (!isAdjacent) return;

    const newTiles = [...tiles];
    [newTiles[blankIdx], newTiles[idx]] = [newTiles[idx], newTiles[blankIdx]];
    setTiles(newTiles);

    if (checkWin(newTiles)) {
      setWon(true);
    }
  };

  if (tiles.length === 0) return <div>Loading...</div>;

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="inline-grid gap-1 bg-gray-300 p-1 rounded-lg"
        style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
      >
        {tiles.map((tile, idx) => (
          <button
            key={idx}
            onClick={() => handleClick(idx)}
            disabled={tile === 0}
            className={`w-20 h-20 text-2xl font-bold rounded-md transition-all ${
              tile === 0
                ? "bg-gray-300 cursor-default"
                : "bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700 shadow-md cursor-pointer"
            }`}
          >
            {tile !== 0 ? tile : ""}
          </button>
        ))}
      </div>

      {won && (
        <div className="px-6 py-3 bg-green-500 text-white rounded-lg text-lg font-semibold">
          You solved it!
        </div>
      )}

    </div>
  );
}
