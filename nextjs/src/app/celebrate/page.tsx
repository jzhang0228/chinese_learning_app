"use client";

import { useStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ProgressBar from "@/components/ProgressBar";

function ConfettiPiece({ index }: { index: number }) {
  const colors = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#06b6d4", "#6366f1"];
  const color = colors[index % colors.length];
  const left = Math.random() * 100;
  const delay = Math.random() * 3;
  const duration = 2 + Math.random() * 3;
  const size = 6 + Math.random() * 8;

  return (
    <div
      style={{
        position: "fixed",
        top: -20,
        left: `${left}%`,
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: Math.random() > 0.5 ? "50%" : "2px",
        animation: `confettiFall ${duration}s ease-in ${delay}s forwards`,
        zIndex: 100,
        pointerEvents: "none",
      }}
    />
  );
}

export default function CelebratePage() {
  const store = useStore();
  const router = useRouter();
  const [rewardGame, setRewardGame] = useState<string>("");

  useEffect(() => {
    const games = store.favoriteGames;
    if (games.length > 0) {
      const game = games[Math.floor(Math.random() * games.length)];
      setRewardGame(game);
      store.setRewardGame(game);
    }
  }, []);

  const handlePlayGame = () => {
    store.setStage("game");
    router.push(`/game?type=${rewardGame}`);
  };

  const handleLearnAnother = () => {
    store.startOver();
    router.push("/");
  };

  return (
    <div className="flex flex-col items-center pt-4 relative">
      <style jsx global>{`
        @keyframes confettiFall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>

      {Array.from({ length: 40 }).map((_, i) => (
        <ConfettiPiece key={i} index={i} />
      ))}

      <ProgressBar step={7} total={8} label="Learning Progress" />

      <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--accent)" }}>
        Congratulations!
      </h1>

      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
        You have mastered a new character!
      </p>

      <div className="big-char mb-2">{store.chineseText}</div>
      <div className="pinyin mb-1">{store.pinyinText}</div>
      <div className="eng-label mb-8">{store.englishWord}</div>

      {/* Summary */}
      <div className="quiz-box w-full max-w-md mb-6">
        <h3 className="font-semibold mb-3" style={{ color: "var(--foreground)" }}>
          Lesson Summary
        </h3>
        <ul className="text-sm flex flex-col gap-2" style={{ color: "var(--foreground)" }}>
          <li>Learned character and pronunciation</li>
          <li>
            Pronunciation quiz:{" "}
            <span className={store.pronQuizPassed ? "text-emerald-600 font-medium" : "text-amber-600 font-medium"}>
              {store.pronQuizPassed ? "Passed" : "Skipped"}
            </span>
          </li>
          <li>Practiced {store.sentencesSpoken.length} example sentence(s)</li>
          <li>
            Sentence quiz:{" "}
            <span className={store.sentQuizPassed ? "text-emerald-600 font-medium" : "text-amber-600 font-medium"}>
              {store.sentQuizPassed ? "Passed" : "Skipped"}
            </span>
          </li>
          <li>
            Writing quiz:{" "}
            <span className={store.writingQuizPassed ? "text-emerald-600 font-medium" : "text-amber-600 font-medium"}>
              {store.writingQuizPassed ? "Passed" : "Attempted"}
            </span>
          </li>
        </ul>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-3 w-full max-w-md">
        {rewardGame && (
          <button onClick={handlePlayGame} className="btn-accent w-full py-3 text-lg">
            Play {rewardGame.charAt(0).toUpperCase() + rewardGame.slice(1)}!
          </button>
        )}
        <button onClick={handleLearnAnother} className="btn-ghost w-full py-3 text-lg">
          Learn Another Word
        </button>
      </div>
    </div>
  );
}
