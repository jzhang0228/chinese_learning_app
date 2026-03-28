"use client";

import { useState, useEffect, useCallback } from "react";

const WORDS = [
  { chinese: "你好", pinyin: "nihao", english: "hello" },
  { chinese: "谢谢", pinyin: "xiexie", english: "thank you" },
  { chinese: "朋友", pinyin: "pengyou", english: "friend" },
  { chinese: "学生", pinyin: "xuesheng", english: "student" },
  { chinese: "老师", pinyin: "laoshi", english: "teacher" },
  { chinese: "中国", pinyin: "zhongguo", english: "China" },
  { chinese: "电脑", pinyin: "diannao", english: "computer" },
  { chinese: "苹果", pinyin: "pingguo", english: "apple" },
  { chinese: "快乐", pinyin: "kuaile", english: "happy" },
  { chinese: "漂亮", pinyin: "piaoliang", english: "beautiful" },
  { chinese: "吃饭", pinyin: "chifan", english: "eat" },
  { chinese: "喝水", pinyin: "heshui", english: "drink water" },
  { chinese: "工作", pinyin: "gongzuo", english: "work" },
  { chinese: "太阳", pinyin: "taiyang", english: "sun" },
  { chinese: "月亮", pinyin: "yueliang", english: "moon" },
];

const MAX_WRONG = 7;
const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");

export default function Hangman() {
  const [word, setWord] = useState(WORDS[0]);
  const [guessed, setGuessed] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState(0);

  const initGame = useCallback(() => {
    setWord(WORDS[Math.floor(Math.random() * WORDS.length)]);
    setGuessed(new Set());
    setWrong(0);
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const won = word.pinyin.split("").every((ch) => guessed.has(ch));
  const lost = wrong >= MAX_WRONG;
  const gameOver = won || lost;

  const handleGuess = (letter: string) => {
    if (gameOver || guessed.has(letter)) return;
    const newGuessed = new Set(guessed);
    newGuessed.add(letter);
    setGuessed(newGuessed);
    if (!word.pinyin.includes(letter)) {
      setWrong((w) => w + 1);
    }
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key.length === 1 && /[a-z]/i.test(e.key)) {
        handleGuess(e.key.toLowerCase());
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  // Simple stick figure
  const parts = [
    <circle key="head" cx="150" cy="50" r="15" stroke="currentColor" strokeWidth="3" fill="none" />,
    <line key="body" x1="150" y1="65" x2="150" y2="120" stroke="currentColor" strokeWidth="3" />,
    <line key="larm" x1="150" y1="80" x2="120" y2="100" stroke="currentColor" strokeWidth="3" />,
    <line key="rarm" x1="150" y1="80" x2="180" y2="100" stroke="currentColor" strokeWidth="3" />,
    <line key="lleg" x1="150" y1="120" x2="125" y2="155" stroke="currentColor" strokeWidth="3" />,
    <line key="rleg" x1="150" y1="120" x2="175" y2="155" stroke="currentColor" strokeWidth="3" />,
    <g key="face">
      <line x1="142" y1="45" x2="147" y2="50" stroke="currentColor" strokeWidth="2" />
      <line x1="147" y1="45" x2="142" y2="50" stroke="currentColor" strokeWidth="2" />
      <line x1="153" y1="45" x2="158" y2="50" stroke="currentColor" strokeWidth="2" />
      <line x1="158" y1="45" x2="153" y2="50" stroke="currentColor" strokeWidth="2" />
      <path d="M 142 58 Q 150 55 158 58" stroke="currentColor" strokeWidth="2" fill="none" />
    </g>,
  ];

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Guess the pinyin spelling! Hint: {word.english}
      </p>

      <div className="text-4xl font-light" style={{ color: "var(--char-color, var(--foreground))" }}>
        {word.chinese}
      </div>

      {/* Hangman figure */}
      <svg width="200" height="170" style={{ color: "var(--foreground)" }}>
        {/* Gallows */}
        <line x1="40" y1="165" x2="160" y2="165" stroke="currentColor" strokeWidth="3" />
        <line x1="80" y1="165" x2="80" y2="10" stroke="currentColor" strokeWidth="3" />
        <line x1="80" y1="10" x2="150" y2="10" stroke="currentColor" strokeWidth="3" />
        <line x1="150" y1="10" x2="150" y2="35" stroke="currentColor" strokeWidth="3" />
        {/* Body parts */}
        {parts.slice(0, wrong)}
      </svg>

      {/* Word display */}
      <div className="flex gap-2 text-2xl font-mono tracking-widest">
        {word.pinyin.split("").map((ch, i) => (
          <span
            key={i}
            className="w-8 text-center border-b-2 pb-1"
            style={{
              borderColor: "var(--foreground)",
              color: guessed.has(ch) ? "var(--foreground)" : "transparent",
            }}
          >
            {guessed.has(ch) || gameOver ? ch : "_"}
          </span>
        ))}
      </div>

      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Wrong guesses: {wrong} / {MAX_WRONG}
      </p>

      {/* Keyboard */}
      <div className="flex flex-wrap gap-1.5 justify-center max-w-md">
        {LETTERS.map((letter) => {
          const isGuessed = guessed.has(letter);
          const isCorrect = isGuessed && word.pinyin.includes(letter);
          const isWrong = isGuessed && !word.pinyin.includes(letter);
          return (
            <button
              key={letter}
              onClick={() => handleGuess(letter)}
              disabled={isGuessed || gameOver}
              className={`w-9 h-9 rounded-md font-semibold text-sm transition-all ${
                isCorrect
                  ? "bg-green-500 text-white"
                  : isWrong
                  ? "bg-red-400 text-white opacity-50"
                  : "bg-gray-200 hover:bg-gray-300 text-gray-700"
              }`}
              style={!isGuessed && !gameOver ? {} : undefined}
            >
              {letter}
            </button>
          );
        })}
      </div>

      {won && (
        <div className="px-6 py-3 bg-green-500 text-white rounded-lg text-lg font-semibold">
          You got it! {word.chinese} = {word.pinyin}
        </div>
      )}
      {lost && (
        <div className="flex flex-col items-center gap-3">
          <div className="px-6 py-3 bg-red-500 text-white rounded-lg text-lg font-semibold">
            The answer was: {word.pinyin} ({word.chinese})
          </div>
          <button
            onClick={initGame}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Play Again
          </button>
        </div>
      )}
      {won && (
        <button
          onClick={initGame}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Next Word
        </button>
      )}
    </div>
  );
}
