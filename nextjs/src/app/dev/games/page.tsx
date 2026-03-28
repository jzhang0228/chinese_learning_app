"use client";

import { useRouter } from "next/navigation";

const GAMES = [
  { key: "sliding", label: "Sliding Puzzle" },
  { key: "lightsout", label: "Lights Out" },
  { key: "minesweeper", label: "Minesweeper" },
  { key: "wordle", label: "Wordle" },
  { key: "nonogram", label: "Nonogram" },
  { key: "snake", label: "Snake" },
  { key: "2048", label: "2048" },
  { key: "hangman", label: "Hangman" },
  { key: "whackamole", label: "Whack-a-Mole" },
  { key: "fallingwords", label: "Falling Words" },
  { key: "maze", label: "Maze" },
  { key: "simonsays", label: "Simon Says" },
  { key: "crossword", label: "Crossword" },
];

export default function DevGamesPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col pt-4 max-w-xl mx-auto px-4">
      <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--foreground)" }}>
        Game Test Page
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
        Dev shortcut — click any game to launch it directly.
      </p>

      <div className="grid grid-cols-2 gap-3">
        {GAMES.map((game) => (
          <button
            key={game.key}
            onClick={() => router.push(`/game?type=${game.key}`)}
            className="btn-primary py-4 text-base"
          >
            {game.label}
          </button>
        ))}
      </div>

      <button
        onClick={() => router.push("/")}
        className="btn-ghost mt-6 w-full"
      >
        Back to Home
      </button>
    </div>
  );
}
