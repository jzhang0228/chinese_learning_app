"use client";

import { useStore } from "@/lib/store";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";

const STAGES = [
  { key: "input", label: "Input Word", path: "/" },
  { key: "learn", label: "Learn", path: "/learn" },
  { key: "pronunciation", label: "Quiz: Pronunciation", path: "/quiz/pronunciation" },
  { key: "sentences", label: "Sentences", path: "/sentences" },
  { key: "sentence-quiz", label: "Quiz: Sentence", path: "/quiz/sentence" },
  { key: "writing", label: "Writing", path: "/writing" },
  { key: "writing-quiz", label: "Quiz: Writing", path: "/writing-quiz" },
  { key: "celebrate", label: "Celebrate", path: "/celebrate" },
  { key: "game", label: "Play Game", path: "/game" },
];

const ALL_GAMES = [
  { key: "sudoku", label: "Sudoku" },
  { key: "puzzle", label: "Puzzle" },
  { key: "memory", label: "Memory" },
  { key: "lights", label: "Lights" },
  { key: "mines", label: "Mines" },
  { key: "wordle", label: "Wordle" },
  { key: "nonogram", label: "Nonogram" },
];

export default function Sidebar() {
  const store = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    store.setUsername(null);
    store.startOver();
    router.push("/");
  };

  const handleStartOver = () => {
    store.startOver();
    router.push("/");
  };

  const toggleGame = (game: string) => {
    const current = store.favoriteGames;
    if (current.includes(game)) {
      store.setFavoriteGames(current.filter((g) => g !== game));
    } else {
      store.setFavoriteGames([...current, game]);
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full p-5 gap-5">
      {/* User info */}
      <div className="border-b pb-4" style={{ borderColor: "var(--card-border)" }}>
        {store.username ? (
          <div className="flex flex-col gap-2">
            <div className="font-bold text-lg" style={{ color: "var(--foreground)" }}>
              {store.username}
            </div>
            <button onClick={handleLogout} className="btn-ghost text-sm py-1.5 px-3">
              Logout
            </button>
          </div>
        ) : (
          <div className="text-sm" style={{ color: "var(--muted)" }}>
            Not logged in
          </div>
        )}
      </div>

      {/* Current word */}
      {store.chineseText && (
        <div className="border-b pb-4" style={{ borderColor: "var(--card-border)" }}>
          <div className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: "var(--muted)" }}>
            Current Word
          </div>
          <div className="text-3xl text-center font-light" style={{ color: "var(--char-color)" }}>
            {store.chineseText}
          </div>
          <div className="text-center text-sm mt-1" style={{ color: "var(--foreground)" }}>
            {store.pinyinText}
          </div>
          <div className="text-center text-xs" style={{ color: "var(--muted)" }}>
            {store.englishWord}
          </div>
        </div>
      )}

      {/* Navigation steps */}
      <div className="flex-1">
        <div className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: "var(--muted)" }}>
          Learning Steps
        </div>
        <nav className="flex flex-col gap-0.5">
          {STAGES.map((stage) => {
            const isCurrent = stage.path === pathname;
            return (
              <button
                key={stage.key}
                onClick={() => {
                  router.push(stage.path);
                  setMobileOpen(false);
                }}
                className="text-left text-sm px-3 py-2 rounded-lg transition-all"
                style={{
                  color: isCurrent ? "var(--primary)" : "var(--foreground)",
                  backgroundColor: isCurrent ? "var(--primary-light)" : undefined,
                  fontWeight: isCurrent ? 600 : 400,
                }}
              >
                {isCurrent ? "› " : "  "}
                {stage.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Settings */}
      <div className="border-t pt-4" style={{ borderColor: "var(--card-border)" }}>
        <button
          onClick={() => setSettingsOpen(!settingsOpen)}
          className="text-xs font-semibold w-full text-left flex items-center justify-between uppercase tracking-wider"
          style={{ color: "var(--muted)" }}
        >
          Settings
          <span className="text-[10px]">{settingsOpen ? "▼" : "▶"}</span>
        </button>
        {settingsOpen && (
          <div className="mt-3 flex flex-col gap-1.5">
            <div className="text-xs mb-1" style={{ color: "var(--muted)" }}>
              Favorite Games
            </div>
            {ALL_GAMES.map((game) => (
              <label key={game.key} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={store.favoriteGames.includes(game.key)}
                  onChange={() => toggleGame(game.key)}
                  className="accent-blue-500 rounded"
                />
                {game.label}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Start Over */}
      <button onClick={handleStartOver} className="btn-ghost w-full text-sm py-2">
        Start Over
      </button>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-3 left-3 z-50 md:hidden p-2 rounded-lg shadow-md bg-white"
        style={{ color: "var(--primary)" }}
      >
        {mobileOpen ? "✕" : "☰"}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 md:hidden backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white shadow-lg z-40 transform transition-transform duration-200 md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } md:static md:block`}
        style={{ borderRight: "1px solid var(--card-border)" }}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
