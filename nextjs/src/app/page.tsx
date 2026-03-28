"use client";

import { useStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";

export default function InputPage() {
  const store = useStore();
  const router = useRouter();

  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPassword2, setAuthPassword2] = useState("");
  const [authError, setAuthError] = useState("");

  const [customWord, setCustomWord] = useState("");
  const [level, setLevel] = useState("auto");
  const [recommendation, setRecommendation] = useState<any>(null);
  const [learnedWords, setLearnedWords] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [userLevel, setUserLevel] = useState<number | null>(null);
  const [dbLevel, setDbLevel] = useState<number | null>(null);
  const dbLevelLoadedRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [reviewWords, setReviewWords] = useState<any[]>([]);
  const [showReviewWords, setShowReviewWords] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const data = await res.json();
          if (data.username) {
            store.setUsername(data.username);
          } else {
            store.setUsername(null);
          }
        } else {
          store.setUsername(null);
        }
      } catch {}
      setSessionChecked(true);
    };
    checkSession();
  }, []);

  const fetchUserData = useCallback(async () => {
    try {
      const res = await fetch("/api/words");
      if (res.ok) {
        const data = await res.json();
        setLearnedWords(data.words || []);
      }
    } catch {}
  }, []);

  const fetchRecommendation = useCallback(async () => {
    try {
      const res = await fetch("/api/recommendation");
      if (res.ok) {
        const data = await res.json();
        if (data.character) {
          setRecommendation(data);
        }
      }
    } catch {}
  }, []);

  const fetchCurrentLevel = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        const lvl = data.current_level || 1;
        setUserLevel(lvl);
        if (!dbLevelLoadedRef.current) {
          dbLevelLoadedRef.current = true;
          setDbLevel(lvl);
        }
      }
    } catch {}
  }, []);

  const fetchReviewWords = useCallback(async () => {
    try {
      const res = await fetch("/api/review-words");
      if (res.ok) {
        const data = await res.json();
        setReviewWords(data.words || []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (store.username) {
      fetchUserData();
      fetchRecommendation();
      fetchReviewWords();
      fetchCurrentLevel();
    }
  }, [store.username, level, fetchUserData, fetchRecommendation, fetchReviewWords, fetchCurrentLevel]);

  useEffect(() => {
    if (store.username && level !== "auto") {
      fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manual_level: parseInt(level) }),
      });
    } else if (store.username && level === "auto") {
      fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manual_level: null }),
      });
    }
  }, [level, store.username]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");

    if (authTab === "register" && authPassword !== authPassword2) {
      setAuthError("Passwords do not match.");
      return;
    }

    try {
      const endpoint =
        authTab === "login" ? "/api/auth/login" : "/api/auth/register";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: authUsername,
          password: authPassword,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        store.setUsername(data.username);
      } else {
        setAuthError(data.error || "Authentication failed");
      }
    } catch {
      setAuthError("Network error — check your connection.");
    }
  };

  const startLearning = async (word: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: word }),
      });
      if (res.ok) {
        const data = await res.json();
        store.setWord(word, data.chinese, data.pinyin);
        store.setStage("learn");
        router.push("/learn");
      }
    } catch {}
    setLoading(false);
  };

  const startLearnFromRecommendation = () => {
    if (recommendation) {
      store.setWord(
        recommendation.english,
        recommendation.character,
        recommendation.pinyin
      );
      store.setStage("learn");
      router.push("/learn");
    }
  };

  const markAsLearned = async (chinese: string, english: string, pinyin: string) => {
    try {
      await fetch("/api/words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chinese, english, pinyin }),
      });
      fetchUserData();
      fetchRecommendation();
      fetchCurrentLevel();
    } catch {}
  };

  if (!sessionChecked) {
    return (
      <div className="flex justify-center pt-20">
        <div className="text-lg" style={{ color: "var(--muted)" }}>
          Loading...
        </div>
      </div>
    );
  }

  // Not logged in
  if (!store.username) {
    return (
      <div className="flex flex-col items-center pt-12">
        <h1 className="text-4xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
          Learn Chinese
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--muted)" }}>
          Master characters one at a time
        </p>

        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-6" style={{ border: "1px solid var(--card-border)" }}>
          <div className="flex mb-5 gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setAuthTab("login")}
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${
                authTab === "login"
                  ? "bg-white shadow-sm"
                  : ""
              }`}
              style={{
                color: authTab === "login" ? "var(--primary)" : "var(--muted)",
              }}
            >
              Login
            </button>
            <button
              onClick={() => setAuthTab("register")}
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${
                authTab === "register"
                  ? "bg-white shadow-sm"
                  : ""
              }`}
              style={{
                color: authTab === "register" ? "var(--primary)" : "var(--muted)",
              }}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleAuth} className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="Username"
              value={authUsername}
              onChange={(e) => setAuthUsername(e.target.value)}
              className="px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
              style={{ borderColor: "var(--card-border)" }}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              className="px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
              style={{ borderColor: "var(--card-border)" }}
              required
            />
            {authTab === "register" && (
              <input
                type="password"
                placeholder="Confirm Password"
                value={authPassword2}
                onChange={(e) => setAuthPassword2(e.target.value)}
                className="px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                style={{ borderColor: "var(--card-border)" }}
                required
              />
            )}
            {authError && (
              <div className="text-red-500 text-sm">{authError}</div>
            )}
            <button type="submit" className="btn-primary w-full py-2.5 text-sm mt-1">
              {authTab === "login" ? "Login" : "Create Account"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Logged in
  return (
    <div className="flex flex-col pt-4 max-w-xl mx-auto px-4">
      <h1 className="text-3xl font-bold text-center mb-1" style={{ color: "var(--foreground)" }}>
        Learn Chinese
      </h1>

      <div className="text-center mb-6">
        <span className="text-sm" style={{ color: "var(--muted)" }}>
          Level {userLevel ?? "..."} ({level === "auto" ? "auto" : "manual"}) · {learnedWords.length} words learned
        </span>
      </div>

      {/* Level selector */}
      <div className="flex items-center justify-center gap-2 mb-6">
        <label className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
          Difficulty:
        </label>
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          className="px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          style={{ borderColor: "var(--card-border)" }}
        >
          <option value="auto">Auto</option>
          {dbLevel != null && Array.from({ length: Math.min(11, 251 - dbLevel) }, (_, i) => (
            <option key={dbLevel + i} value={String(dbLevel + i)}>
              Level {dbLevel + i}
            </option>
          ))}
        </select>
      </div>

      {/* Recommended word */}
      {recommendation && (
        <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm" style={{ border: "1px solid var(--card-border)" }}>
          <div className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: "var(--muted)" }}>
            Recommended for you
          </div>
          <div className="text-5xl text-center mb-1 font-light" style={{ color: "var(--char-color)" }}>
            {recommendation.character}
          </div>
          <div className="text-center text-sm mb-0.5" style={{ color: "var(--foreground)" }}>
            {recommendation.pinyin}
          </div>
          <div className="text-center text-sm mb-4" style={{ color: "var(--muted)" }}>
            {recommendation.english} · Level {recommendation.level} · Rank #{recommendation.rank}
          </div>
          <div className="flex gap-2">
            <button
              onClick={startLearnFromRecommendation}
              disabled={loading}
              className="btn-accent flex-1 py-2.5 text-sm"
            >
              {loading
                ? "Loading..."
                : `Learn ${recommendation.character}`}
            </button>
            <button
              onClick={() => markAsLearned(recommendation.character, recommendation.english, recommendation.pinyin)}
              className="btn-ghost text-sm py-2.5"
            >
              Already Know
            </button>
          </div>
        </div>
      )}

      {/* Custom word input */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-4" style={{ border: "1px solid var(--card-border)" }}>
        <div className="text-sm mb-3" style={{ color: "var(--muted)" }}>
          Or enter your own word:
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. hello, water, thank you..."
            value={customWord}
            onChange={(e) => setCustomWord(e.target.value)}
            className="flex-1 px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            style={{ borderColor: "var(--card-border)" }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && customWord.trim()) {
                startLearning(customWord.trim());
              }
            }}
          />
          <button
            onClick={() =>
              customWord.trim() && startLearning(customWord.trim())
            }
            disabled={loading || !customWord.trim()}
            className="btn-primary text-sm whitespace-nowrap"
          >
            {loading ? "..." : "Learn"}
          </button>
        </div>
      </div>

      {/* Review section */}
      {learnedWords.length >= 2 && (
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-4" style={{ border: "1px solid var(--card-border)" }}>
          <div className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: "var(--muted)" }}>
            Review your words
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push("/review/memory")}
              className="btn-primary flex-1 text-sm py-2.5"
            >
              Memory Match
            </button>
            <button
              onClick={() => router.push("/review/sky-drop")}
              className="btn-accent flex-1 text-sm py-2.5"
            >
              Sky Drop
            </button>
          </div>
        </div>
      )}

      {/* Words needing review */}
      {reviewWords.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-4" style={{ border: "1px solid var(--card-border)" }}>
          <button
            onClick={() => setShowReviewWords(!showReviewWords)}
            className="text-sm font-semibold w-full text-left flex items-center justify-between"
            style={{ color: "#f59e0b" }}
          >
            Words to review ({reviewWords.length})
            <span className="text-xs" style={{ color: "var(--muted)" }}>{showReviewWords ? "▼" : "▶"}</span>
          </button>
          {showReviewWords && (
            <div className="mt-3 flex flex-col gap-1.5">
              {reviewWords.map((w: any, i: number) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-amber-50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl min-w-[48px] font-light" style={{ color: "var(--char-color)" }}>
                      {w.chinese}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                        {w.pinyin}
                      </span>
                      <span className="text-xs" style={{ color: "var(--muted)" }}>
                        {w.english}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100" style={{ color: "#92400e" }}>
                      {w.consecutive_correct}/5
                    </span>
                    <button
                      onClick={() => {
                        store.setWord(w.english, w.chinese, w.pinyin);
                        store.setStage("learn");
                        router.push("/learn");
                      }}
                      className="btn-primary text-xs py-1 px-3"
                    >
                      Re-learn
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Learned words history */}
      {learnedWords.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-5" style={{ border: "1px solid var(--card-border)" }}>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-sm font-semibold w-full text-left flex items-center justify-between"
            style={{ color: "var(--foreground)" }}
          >
            Words you&apos;ve learned ({learnedWords.length})
            <span className="text-xs" style={{ color: "var(--muted)" }}>{showHistory ? "▼" : "▶"}</span>
          </button>
          {showHistory && (
            <div className="mt-3 flex flex-col gap-1.5">
              {[...learnedWords].reverse().map((w: any, i: number) => (
                <div
                  key={i}
                  className="flex items-center gap-4 px-3 py-2.5 rounded-xl transition-colors hover:bg-gray-50"
                >
                  <span className="text-2xl min-w-[48px] font-light" style={{ color: "var(--char-color)" }}>
                    {w.chinese}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                      {w.english}
                    </span>
                    <span className="text-xs" style={{ color: "var(--muted)" }}>
                      {w.pinyin}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
