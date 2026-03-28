"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface ClueWord {
  chinese: string;
  pinyin: string;
  meaning: string;
}

interface PlacedWord {
  word: ClueWord;
  row: number;
  col: number;
  direction: "across" | "down";
  number: number;
}

const WORD_SETS: ClueWord[][] = [
  [
    { chinese: "你好", pinyin: "nihao", meaning: "hello" },
    { chinese: "好人", pinyin: "haoren", meaning: "good person" },
    { chinese: "人生", pinyin: "rensheng", meaning: "life" },
    { chinese: "生活", pinyin: "shenghuo", meaning: "living" },
    { chinese: "活力", pinyin: "huoli", meaning: "energy" },
  ],
  [
    { chinese: "大学", pinyin: "daxue", meaning: "university" },
    { chinese: "学生", pinyin: "xuesheng", meaning: "student" },
    { chinese: "生日", pinyin: "shengri", meaning: "birthday" },
    { chinese: "日本", pinyin: "riben", meaning: "Japan" },
    { chinese: "本子", pinyin: "benzi", meaning: "notebook" },
  ],
  [
    { chinese: "中国", pinyin: "zhongguo", meaning: "China" },
    { chinese: "国家", pinyin: "guojia", meaning: "country" },
    { chinese: "家人", pinyin: "jiaren", meaning: "family" },
    { chinese: "人民", pinyin: "renmin", meaning: "people" },
    { chinese: "民主", pinyin: "minzhu", meaning: "democracy" },
  ],
];

const GRID_SIZE = 8;

function buildPuzzle(wordSet: ClueWord[]): { grid: string[][]; placed: PlacedWord[] } {
  const grid: string[][] = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(""));
  const placed: PlacedWord[] = [];
  let num = 1;

  // Place first word across, centered
  const w0 = wordSet[0];
  const chars0 = w0.chinese.split("");
  const startCol = Math.floor((GRID_SIZE - chars0.length) / 2);
  const startRow = 1;
  chars0.forEach((ch, i) => {
    grid[startRow][startCol + i] = ch;
  });
  placed.push({ word: w0, row: startRow, col: startCol, direction: "across", number: num++ });

  // Try to place remaining words by finding shared characters
  for (let wi = 1; wi < wordSet.length; wi++) {
    const w = wordSet[wi];
    const wChars = w.chinese.split("");
    let didPlace = false;

    // Try to intersect with already placed characters
    for (let ci = 0; ci < wChars.length && !didPlace; ci++) {
      for (let r = 0; r < GRID_SIZE && !didPlace; r++) {
        for (let c = 0; c < GRID_SIZE && !didPlace; c++) {
          if (grid[r][c] !== wChars[ci]) continue;

          // Try placing down
          const dr = r - ci;
          if (dr >= 0 && dr + wChars.length <= GRID_SIZE) {
            let canPlace = true;
            for (let j = 0; j < wChars.length; j++) {
              const gr = dr + j;
              if (grid[gr][c] !== "" && grid[gr][c] !== wChars[j]) {
                canPlace = false;
                break;
              }
            }
            if (canPlace) {
              wChars.forEach((ch, j) => {
                grid[dr + j][c] = ch;
              });
              placed.push({ word: w, row: dr, col: c, direction: "down", number: num++ });
              didPlace = true;
            }
          }

          if (didPlace) break;

          // Try placing across
          const dc = c - ci;
          if (dc >= 0 && dc + wChars.length <= GRID_SIZE) {
            let canPlace = true;
            for (let j = 0; j < wChars.length; j++) {
              const gc = dc + j;
              if (grid[r][gc] !== "" && grid[r][gc] !== wChars[j]) {
                canPlace = false;
                break;
              }
            }
            if (canPlace) {
              wChars.forEach((ch, j) => {
                grid[r][dc + j] = ch;
              });
              placed.push({ word: w, row: r, col: dc, direction: "across", number: num++ });
              didPlace = true;
            }
          }
        }
      }
    }
  }

  return { grid, placed };
}

export default function Crossword() {
  const [grid, setGrid] = useState<string[][]>([]);
  const [placed, setPlaced] = useState<PlacedWord[]>([]);
  const [userGrid, setUserGrid] = useState<string[][]>([]);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [won, setWon] = useState(false);
  const [showHint, setShowHint] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const initGame = useCallback(() => {
    const wordSet = WORD_SETS[Math.floor(Math.random() * WORD_SETS.length)];
    const { grid: g, placed: p } = buildPuzzle(wordSet);
    setGrid(g);
    setPlaced(p);
    setUserGrid(Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill("")));
    setSelected(null);
    setWon(false);
    setShowHint(null);
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const checkWin = useCallback(
    (ug: string[][]) => {
      for (let r = 0; r < GRID_SIZE; r++)
        for (let c = 0; c < GRID_SIZE; c++)
          if (grid[r][c] && ug[r][c] !== grid[r][c]) return false;
      return true;
    },
    [grid]
  );

  const handleCellClick = (r: number, c: number) => {
    if (!grid[r][c] || won) return;
    setSelected([r, c]);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleInput = (value: string) => {
    if (!selected || won) return;
    const [r, c] = selected;
    const char = value.slice(-1); // Take last character (for IME)
    const newGrid = userGrid.map((row) => [...row]);
    newGrid[r][c] = char;
    setUserGrid(newGrid);
    if (checkWin(newGrid)) setWon(true);
  };

  // Get number labels for cells
  const numberMap = new Map<string, number>();
  placed.forEach((p) => {
    const key = `${p.row},${p.col}`;
    if (!numberMap.has(key)) numberMap.set(key, p.number);
  });

  if (grid.length === 0) return <div>Loading...</div>;

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Fill in the Chinese characters! Tap a cell and type.
      </p>

      {/* Hidden input for IME */}
      <input
        ref={inputRef}
        type="text"
        value=""
        onChange={(e) => handleInput(e.target.value)}
        className="absolute opacity-0 w-0 h-0"
        style={{ pointerEvents: "none" }}
        autoComplete="off"
      />

      {/* Grid */}
      <div
        className="inline-grid"
        style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`, gap: 0 }}
      >
        {grid.map((row, r) =>
          row.map((cell, c) => {
            const isActive = cell !== "";
            const isSelected = selected?.[0] === r && selected?.[1] === c;
            const isCorrect = userGrid[r][c] && userGrid[r][c] === grid[r][c];
            const isWrong = userGrid[r][c] && userGrid[r][c] !== grid[r][c];
            const num = numberMap.get(`${r},${c}`);

            return (
              <div
                key={`${r}-${c}`}
                onClick={() => handleCellClick(r, c)}
                className={`w-11 h-11 border flex items-center justify-center relative text-lg font-medium transition-all ${
                  !isActive
                    ? "bg-gray-800 border-gray-700"
                    : isSelected
                    ? "bg-blue-100 border-blue-500 cursor-pointer"
                    : isCorrect
                    ? "bg-green-50 border-green-300 cursor-pointer"
                    : isWrong
                    ? "bg-red-50 border-red-300 cursor-pointer"
                    : "bg-white border-gray-300 cursor-pointer hover:bg-gray-50"
                }`}
              >
                {num && (
                  <span className="absolute top-0.5 left-1 text-[9px] text-gray-400">{num}</span>
                )}
                {isActive && (
                  <span style={{ color: isCorrect ? "#16a34a" : isWrong ? "#dc2626" : "#1f2937" }}>
                    {userGrid[r][c] || ""}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Clues */}
      <div className="flex flex-col sm:flex-row gap-4 text-sm w-full max-w-lg">
        <div className="flex-1">
          <div className="font-semibold mb-1" style={{ color: "var(--foreground)" }}>Across</div>
          {placed.filter((p) => p.direction === "across").map((p) => (
            <div
              key={p.number}
              className="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-50 rounded px-1"
              onClick={() => setShowHint(showHint === p.number ? null : p.number)}
            >
              <span className="font-mono text-gray-400 w-4">{p.number}.</span>
              <span style={{ color: "var(--foreground)" }}>{p.word.meaning}</span>
              {showHint === p.number && (
                <span className="text-xs text-blue-500 ml-auto">{p.word.pinyin}</span>
              )}
            </div>
          ))}
        </div>
        <div className="flex-1">
          <div className="font-semibold mb-1" style={{ color: "var(--foreground)" }}>Down</div>
          {placed.filter((p) => p.direction === "down").map((p) => (
            <div
              key={p.number}
              className="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-50 rounded px-1"
              onClick={() => setShowHint(showHint === p.number ? null : p.number)}
            >
              <span className="font-mono text-gray-400 w-4">{p.number}.</span>
              <span style={{ color: "var(--foreground)" }}>{p.word.meaning}</span>
              {showHint === p.number && (
                <span className="text-xs text-blue-500 ml-auto">{p.word.pinyin}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs" style={{ color: "var(--muted)" }}>
        Click a clue to reveal its pinyin hint
      </p>

      {won && (
        <div className="flex flex-col items-center gap-3">
          <div className="px-6 py-3 bg-green-500 text-white rounded-lg text-lg font-semibold">
            Puzzle complete!
          </div>
          <button
            onClick={initGame}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            New Puzzle
          </button>
        </div>
      )}
    </div>
  );
}
