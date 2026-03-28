"use client";

import { useState, useEffect, useCallback } from "react";

const WORD_LIST = [
  "APPLE", "BRAVE", "CHAIR", "DANCE", "EARTH", "FAITH", "GRACE", "HAPPY",
  "IMAGE", "JUICE", "KNEEL", "LIGHT", "MAGIC", "NIGHT", "OCEAN", "PEACE",
  "QUEEN", "RIVER", "SMILE", "TABLE", "VOICE", "WATER", "YACHT", "ANGEL",
  "BEACH", "CLOUD", "DREAM", "EAGLE", "FLAME", "HEART", "JEWEL", "LEMON",
  "MUSIC", "NOBLE", "OLIVE", "PIANO", "QUIET", "STONE", "TIGER", "WHEAT",
];

const MAX_ATTEMPTS = 6;

export default function Wordle() {
  const [target, setTarget] = useState("");
  const [guesses, setGuesses] = useState<string[]>([]);
  const [currentGuess, setCurrentGuess] = useState("");
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [message, setMessage] = useState("");

  const initGame = useCallback(() => {
    setTarget(WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)]);
    setGuesses([]);
    setCurrentGuess("");
    setGameOver(false);
    setWon(false);
    setMessage("");
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const getColors = (guess: string): string[] => {
    const colors = Array(5).fill("bg-gray-400");
    const targetArr = target.split("");
    const guessArr = guess.split("");
    const used = Array(5).fill(false);

    // Green pass
    for (let i = 0; i < 5; i++) {
      if (guessArr[i] === targetArr[i]) {
        colors[i] = "bg-green-500";
        used[i] = true;
        guessArr[i] = "#";
      }
    }
    // Yellow pass
    for (let i = 0; i < 5; i++) {
      if (colors[i] === "bg-green-500") continue;
      for (let j = 0; j < 5; j++) {
        if (!used[j] && guessArr[i] === targetArr[j]) {
          colors[i] = "bg-yellow-500";
          used[j] = true;
          break;
        }
      }
    }
    return colors;
  };

  const handleSubmit = () => {
    if (gameOver) return;
    const guess = currentGuess.toUpperCase();
    if (guess.length !== 5) {
      setMessage("Enter a 5-letter word");
      return;
    }
    if (!/^[A-Z]{5}$/.test(guess)) {
      setMessage("Only letters allowed");
      return;
    }

    const newGuesses = [...guesses, guess];
    setGuesses(newGuesses);
    setCurrentGuess("");
    setMessage("");

    if (guess === target) {
      setWon(true);
      setGameOver(true);
      setMessage("Congratulations! You got it!");
    } else if (newGuesses.length >= MAX_ATTEMPTS) {
      setGameOver(true);
      setMessage(`Game over! The word was ${target}`);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Grid */}
      <div className="flex flex-col gap-1">
        {Array.from({ length: MAX_ATTEMPTS }, (_, rowIdx) => {
          const guess = guesses[rowIdx];
          const colors = guess ? getColors(guess) : [];

          return (
            <div key={rowIdx} className="flex gap-1">
              {Array.from({ length: 5 }, (_, colIdx) => {
                const letter = guess ? guess[colIdx] : "";
                const colorClass = guess
                  ? colors[colIdx]
                  : "bg-white border-2 border-gray-300";

                return (
                  <div
                    key={colIdx}
                    className={`w-14 h-14 flex items-center justify-center text-xl font-bold rounded ${colorClass} ${
                      guess ? "text-white" : "text-gray-800"
                    }`}
                  >
                    {letter}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Input */}
      {!gameOver && (
        <div className="flex gap-2">
          <input
            type="text"
            maxLength={5}
            value={currentGuess}
            onChange={(e) => setCurrentGuess(e.target.value.replace(/[^a-zA-Z]/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className="px-4 py-2 border-2 border-gray-300 rounded-lg text-center text-lg uppercase tracking-widest w-40 focus:outline-none focus:border-blue-500"
            placeholder="GUESS"
          />
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Submit
          </button>
        </div>
      )}

      {message && (
        <div
          className={`px-4 py-2 rounded-lg text-white ${
            won ? "bg-green-500" : gameOver ? "bg-red-500" : "bg-yellow-500"
          }`}
        >
          {message}
        </div>
      )}

    </div>
  );
}
