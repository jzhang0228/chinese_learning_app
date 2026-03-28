"use client";

import { useState, useEffect, useCallback } from "react";

const DEFAULT_PAIRS = [
  { chinese: "你好", english: "Hello" },
  { chinese: "谢谢", english: "Thank you" },
  { chinese: "水", english: "Water" },
  { chinese: "火", english: "Fire" },
  { chinese: "山", english: "Mountain" },
  { chinese: "猫", english: "Cat" },
  { chinese: "狗", english: "Dog" },
  { chinese: "书", english: "Book" },
  { chinese: "家", english: "Home" },
  { chinese: "爱", english: "Love" },
  { chinese: "吃", english: "Eat" },
  { chinese: "喝", english: "Drink" },
  { chinese: "大", english: "Big" },
  { chinese: "小", english: "Small" },
  { chinese: "红", english: "Red" },
  { chinese: "蓝", english: "Blue" },
];

interface Card {
  id: number;
  pairId: number;
  text: string;
  type: "chinese" | "english";
}

interface MemoryMatchProps {
  pairs?: { chinese: string; english: string }[];
  onWin?: () => void;
}

export default function MemoryMatch({ pairs, onWin }: MemoryMatchProps) {
  const [cards, setCards] = useState<Card[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [won, setWon] = useState(false);
  const [canFlip, setCanFlip] = useState(true);

  const initGame = useCallback(() => {
    const source = pairs || DEFAULT_PAIRS;
    const shuffled = [...source].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 8);

    const cardList: Card[] = [];
    selected.forEach((pair, idx) => {
      cardList.push({ id: idx * 2, pairId: idx, text: pair.chinese, type: "chinese" });
      cardList.push({ id: idx * 2 + 1, pairId: idx, text: pair.english, type: "english" });
    });

    for (let i = cardList.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cardList[i], cardList[j]] = [cardList[j], cardList[i]];
    }

    setCards(cardList);
    setFlipped([]);
    setMatched(new Set());
    setWon(false);
    setCanFlip(true);
  }, [pairs]);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const handleClick = (id: number) => {
    if (!canFlip) return;
    if (flipped.includes(id) || matched.has(id)) return;

    const newFlipped = [...flipped, id];
    setFlipped(newFlipped);

    if (newFlipped.length === 2) {
      setCanFlip(false);
      const [first, second] = newFlipped;
      const card1 = cards.find((c) => c.id === first)!;
      const card2 = cards.find((c) => c.id === second)!;

      if (card1.pairId === card2.pairId && card1.type !== card2.type) {
        const newMatched = new Set(matched);
        newMatched.add(first);
        newMatched.add(second);
        setMatched(newMatched);
        setFlipped([]);
        setCanFlip(true);

        if (newMatched.size === cards.length) {
          setWon(true);
          onWin?.();
        }
      }
    }
  };

  const handleContinue = () => {
    setFlipped([]);
    setCanFlip(true);
  };

  if (cards.length === 0) return <div>Loading...</div>;

  const showContinue = flipped.length === 2 && !matched.has(flipped[0]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="inline-grid gap-2"
        style={{ gridTemplateColumns: "repeat(4, 1fr)" }}
      >
        {cards.map((card) => {
          const isFlipped = flipped.includes(card.id);
          const isMatched = matched.has(card.id);
          const showFace = isFlipped || isMatched;

          return (
            <button
              key={card.id}
              onClick={() => handleClick(card.id)}
              className={`w-24 h-28 rounded-lg font-semibold transition-all border-2 ${card.type === "chinese" ? "text-2xl" : "text-base"} ${
                isMatched
                  ? "bg-green-200 border-green-500 text-green-800"
                  : isFlipped
                  ? "bg-yellow-200 border-yellow-500 text-yellow-800"
                  : "bg-blue-500 border-blue-600 text-white hover:bg-blue-600 cursor-pointer"
              }`}
            >
              {showFace ? card.text : "?"}
            </button>
          );
        })}
      </div>

      {showContinue && (
        <button
          onClick={handleContinue}
          className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          Continue
        </button>
      )}

      {won && (
        <div className="px-6 py-3 bg-green-500 text-white rounded-lg text-lg font-semibold">
          You matched all pairs!
        </div>
      )}
    </div>
  );
}
