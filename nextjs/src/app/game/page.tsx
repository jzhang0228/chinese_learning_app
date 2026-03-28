"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import SlidingPuzzle from "@/components/games/SlidingPuzzle";
import LightsOut from "@/components/games/LightsOut";
import Minesweeper from "@/components/games/Minesweeper";
import Wordle from "@/components/games/Wordle";
import Nonogram from "@/components/games/Nonogram";
import Snake from "@/components/games/Snake";
import Game2048 from "@/components/games/Game2048";
import Hangman from "@/components/games/Hangman";
import WhackAMole from "@/components/games/WhackAMole";
import FallingWords from "@/components/games/FallingWords";
import Maze from "@/components/games/Maze";
import SimonSays from "@/components/games/SimonSays";
import Crossword from "@/components/games/Crossword";

function GameContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const type = searchParams.get("type") || "sliding";

  const games: Record<string, React.ReactNode> = {
    sliding: <SlidingPuzzle />,
    lightsout: <LightsOut />,
    minesweeper: <Minesweeper />,
    wordle: <Wordle />,
    nonogram: <Nonogram />,
    snake: <Snake />,
    "2048": <Game2048 />,
    hangman: <Hangman />,
    whackamole: <WhackAMole />,
    fallingwords: <FallingWords />,
    maze: <Maze />,
    simonsays: <SimonSays />,
    crossword: <Crossword />,
  };

  const gameComponent = games[type];

  return (
    <div className="min-h-screen py-8 px-4" style={{ backgroundColor: "var(--background)" }}>
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold capitalize" style={{ color: "var(--foreground)" }}>
            {type.replace(/([A-Z])/g, " $1").trim()} Game
          </h1>
          <button onClick={() => router.push("/")} className="btn-primary text-sm">
            Learn Another Word
          </button>
        </div>
        {gameComponent ? (
          gameComponent
        ) : (
          <div className="text-center py-20">
            <p style={{ color: "var(--muted)" }} className="text-lg">
              Unknown game type: {type}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function GamePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          Loading...
        </div>
      }
    >
      <GameContent />
    </Suspense>
  );
}
