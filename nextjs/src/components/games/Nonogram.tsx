"use client";

import { useState, useEffect, useCallback } from "react";

const PUZZLES = [
  // heart
  [[0,1,1,1,0],[1,1,0,1,1],[1,1,1,1,1],[0,1,1,1,0],[0,0,1,0,0]],
  // diamond
  [[0,0,1,0,0],[0,1,1,1,0],[1,1,1,1,1],[0,1,1,1,0],[0,0,1,0,0]],
  // square
  [[1,1,1,1,1],[1,0,0,0,1],[1,0,1,0,1],[1,0,0,0,1],[1,1,1,1,1]],
  // X
  [[1,0,0,0,1],[0,1,0,1,0],[0,0,1,0,0],[0,1,0,1,0],[1,0,0,0,1]],
  // plus
  [[0,0,1,0,0],[0,0,1,0,0],[1,1,1,1,1],[0,0,1,0,0],[0,0,1,0,0]],
];

function calcClues(line: number[]): number[] {
  const clues: number[] = [];
  let count = 0;
  for (const v of line) {
    if (v === 1) {
      count++;
    } else if (count > 0) {
      clues.push(count);
      count = 0;
    }
  }
  if (count > 0) clues.push(count);
  return clues.length > 0 ? clues : [0];
}

export default function Nonogram() {
  const [solution, setSolution] = useState<number[][]>([]);
  const [grid, setGrid] = useState<number[][]>([]);
  const [rowClues, setRowClues] = useState<number[][]>([]);
  const [colClues, setColClues] = useState<number[][]>([]);
  const [won, setWon] = useState(false);

  const initGame = useCallback(() => {
    const puzzle = PUZZLES[Math.floor(Math.random() * PUZZLES.length)];
    setSolution(puzzle);
    setGrid(Array.from({ length: 5 }, () => Array(5).fill(0)));

    const rClues = puzzle.map((row) => calcClues(row));
    const cClues = Array.from({ length: 5 }, (_, c) =>
      calcClues(puzzle.map((row) => row[c]))
    );
    setRowClues(rClues);
    setColClues(cClues);
    setWon(false);
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const toggleCell = (r: number, c: number) => {
    if (won) return;
    const newGrid = grid.map((row) => [...row]);
    newGrid[r][c] = newGrid[r][c] === 1 ? 0 : 1;
    setGrid(newGrid);

    // Check win
    let match = true;
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        if (newGrid[i][j] !== solution[i][j]) {
          match = false;
          break;
        }
      }
      if (!match) break;
    }
    if (match) setWon(true);
  };

  if (solution.length === 0) return <div>Loading...</div>;

  const maxRowClueLen = Math.max(...rowClues.map((c) => c.length));
  const maxColClueLen = Math.max(...colClues.map((c) => c.length));

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-gray-600 text-sm">
        Fill in the cells to match the row and column clues.
      </p>

      <table className="border-collapse">
        <thead>
          {Array.from({ length: maxColClueLen }, (_, clueRow) => (
            <tr key={`col-clue-${clueRow}`}>
              {/* Empty cells for row clue columns */}
              {Array.from({ length: maxRowClueLen }, (_, i) => (
                <td key={`empty-${i}`} className="w-8 h-8" />
              ))}
              {colClues.map((clue, c) => {
                const padded = Array(maxColClueLen - clue.length)
                  .fill("")
                  .concat(clue);
                return (
                  <td
                    key={c}
                    className="w-10 h-8 text-center text-sm font-semibold text-gray-700"
                  >
                    {padded[clueRow] !== "" ? padded[clueRow] : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {grid.map((row, r) => (
            <tr key={r}>
              {/* Row clues */}
              {Array.from({ length: maxRowClueLen }, (_, i) => {
                const padded = Array(maxRowClueLen - rowClues[r].length)
                  .fill("")
                  .concat(rowClues[r]);
                return (
                  <td
                    key={`rc-${i}`}
                    className="w-8 h-10 text-center text-sm font-semibold text-gray-700"
                  >
                    {padded[i] !== "" ? padded[i] : ""}
                  </td>
                );
              })}
              {/* Grid cells */}
              {row.map((cell, c) => (
                <td
                  key={c}
                  onClick={() => toggleCell(r, c)}
                  className={`w-10 h-10 border border-gray-400 cursor-pointer transition-colors ${
                    cell === 1
                      ? "bg-gray-800"
                      : "bg-white hover:bg-gray-100"
                  }`}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {won && (
        <div className="px-6 py-3 bg-green-500 text-white rounded-lg text-lg font-semibold">
          You solved it!
        </div>
      )}

      <button
        onClick={initGame}
        className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
      >
        New Puzzle
      </button>
    </div>
  );
}
