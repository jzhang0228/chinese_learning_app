"use client";

import { useState, useEffect, useCallback } from "react";

function ok(board: number[][], r: number, c: number, n: number): boolean {
  for (let i = 0; i < 9; i++) {
    if (board[r][i] === n) return false;
    if (board[i][c] === n) return false;
  }
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let i = br; i < br + 3; i++) {
    for (let j = bc; j < bc + 3; j++) {
      if (board[i][j] === n) return false;
    }
  }
  return true;
}

function solve(board: number[][]): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] === 0) {
        const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];
        for (let i = nums.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [nums[i], nums[j]] = [nums[j], nums[i]];
        }
        for (const n of nums) {
          if (ok(board, r, c, n)) {
            board[r][c] = n;
            if (solve(board)) return true;
            board[r][c] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

export default function Sudoku() {
  const [solution, setSolution] = useState<number[][]>([]);
  const [puzzle, setPuzzle] = useState<number[][]>([]);
  const [userInput, setUserInput] = useState<number[][]>([]);
  const [fixed, setFixed] = useState<boolean[][]>([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  const initGame = useCallback(() => {
    const board = Array.from({ length: 9 }, () => Array(9).fill(0));
    solve(board);
    const sol = board.map((r) => [...r]);

    const puz = board.map((r) => [...r]);
    let removed = 0;
    while (removed < 30) {
      const r = Math.floor(Math.random() * 9);
      const c = Math.floor(Math.random() * 9);
      if (puz[r][c] !== 0) {
        puz[r][c] = 0;
        removed++;
      }
    }

    const fix = puz.map((r) => r.map((v) => v !== 0));
    const input = puz.map((r) => [...r]);

    setSolution(sol);
    setPuzzle(puz);
    setUserInput(input);
    setFixed(fix);
    setMessage("");
    setMessageType("");
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const handleChange = (r: number, c: number, val: string) => {
    if (fixed[r]?.[c]) return;
    const num = parseInt(val);
    const newInput = userInput.map((row) => [...row]);
    newInput[r][c] = isNaN(num) || num < 1 || num > 9 ? 0 : num;
    setUserInput(newInput);
  };

  const checkAnswer = () => {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (userInput[r][c] !== solution[r][c]) {
          setMessage("Some cells are incorrect. Keep trying!");
          setMessageType("error");
          return;
        }
      }
    }
    setMessage("Congratulations! You solved the Sudoku!");
    setMessageType("success");
  };

  if (puzzle.length === 0) return <div>Generating puzzle...</div>;

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="inline-grid gap-0 border-2 border-gray-800"
        style={{ gridTemplateColumns: "repeat(9, 1fr)" }}
      >
        {puzzle.map((row, r) =>
          row.map((_, c) => {
            const boxRow = Math.floor(r / 3);
            const boxCol = Math.floor(c / 3);
            const isDark = (boxRow + boxCol) % 2 === 1;
            const bg = isDark ? "#e0e0e0" : "#f5f5f5";
            const isFixed = fixed[r][c];

            return (
              <div
                key={`${r}-${c}`}
                style={{
                  width: 44,
                  height: 44,
                  backgroundColor: bg,
                  borderRight: (c + 1) % 3 === 0 && c < 8 ? "2px solid #333" : "1px solid #999",
                  borderBottom: (r + 1) % 3 === 0 && r < 8 ? "2px solid #333" : "1px solid #999",
                  borderLeft: c === 0 ? "none" : undefined,
                  borderTop: r === 0 ? "none" : undefined,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isFixed ? (
                  <span className="font-bold text-lg text-gray-800">
                    {puzzle[r][c]}
                  </span>
                ) : (
                  <input
                    type="text"
                    maxLength={1}
                    value={userInput[r]?.[c] || ""}
                    onChange={(e) => handleChange(r, c, e.target.value)}
                    className="w-full h-full text-center text-lg bg-transparent outline-none focus:bg-blue-100 text-blue-700"
                    style={{ border: "none" }}
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={checkAnswer}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          Check Answer
        </button>
        <button
          onClick={initGame}
          className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          New Game
        </button>
      </div>

      {message && (
        <div
          className={`px-4 py-2 rounded-lg text-white ${
            messageType === "success" ? "bg-green-500" : "bg-red-500"
          }`}
        >
          {message}
        </div>
      )}
    </div>
  );
}
