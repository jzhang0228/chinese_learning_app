"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

export interface ExampleSentence {
  chinese: string;
  pinyin: string;
  english: string;
}

export interface StoreState {
  username: string | null;
  stage: string;
  englishWord: string;
  chineseText: string;
  pinyinText: string;
  exampleSentences: ExampleSentence[];
  pronQuizPassed: boolean;
  sentQuizPassed: boolean;
  writingQuizPassed: boolean;
  sentencesSpoken: number[];
  favoriteGames: string[];
  rewardGame: string | null;
}

export interface StoreActions {
  setUsername: (username: string | null) => void;
  setStage: (stage: string) => void;
  setWord: (english: string, chinese: string, pinyin: string) => void;
  setExampleSentences: (sentences: ExampleSentence[]) => void;
  setPronQuizPassed: (passed: boolean) => void;
  setSentQuizPassed: (passed: boolean) => void;
  setWritingQuizPassed: (passed: boolean) => void;
  addSentenceSpoken: (index: number) => void;
  setFavoriteGames: (games: string[]) => void;
  setRewardGame: (game: string | null) => void;
  startOver: () => void;
}

const initialState: StoreState = {
  username: null,
  stage: "input",
  englishWord: "",
  chineseText: "",
  pinyinText: "",
  exampleSentences: [],
  pronQuizPassed: false,
  sentQuizPassed: false,
  writingQuizPassed: false,
  sentencesSpoken: [],
  favoriteGames: ["memory", "puzzle", "sudoku"],
  rewardGame: null,
};

const StoreContext = createContext<(StoreState & StoreActions) | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoreState>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("chinese_app_store");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return { ...initialState, ...parsed };
        } catch {}
      }
    }
    return initialState;
  });

  const persist = useCallback((newState: StoreState) => {
    setState(newState);
    if (typeof window !== "undefined") {
      localStorage.setItem("chinese_app_store", JSON.stringify(newState));
    }
  }, []);

  const setUsername = useCallback((username: string | null) => {
    setState((prev) => {
      const next = { ...prev, username };
      persist(next);
      return next;
    });
  }, [persist]);

  const setStage = useCallback((stage: string) => {
    setState((prev) => {
      const next = { ...prev, stage };
      persist(next);
      return next;
    });
  }, [persist]);

  const setWord = useCallback((english: string, chinese: string, pinyin: string) => {
    setState((prev) => {
      const next = {
        ...prev,
        englishWord: english,
        chineseText: chinese,
        pinyinText: pinyin,
        exampleSentences: [],
        sentencesSpoken: [],
        pronQuizPassed: false,
        sentQuizPassed: false,
        writingQuizPassed: false,
      };
      persist(next);
      return next;
    });
  }, [persist]);

  const setExampleSentences = useCallback((sentences: ExampleSentence[]) => {
    setState((prev) => {
      const next = { ...prev, exampleSentences: sentences };
      persist(next);
      return next;
    });
  }, [persist]);

  const setPronQuizPassed = useCallback((passed: boolean) => {
    setState((prev) => {
      const next = { ...prev, pronQuizPassed: passed };
      persist(next);
      return next;
    });
  }, [persist]);

  const setSentQuizPassed = useCallback((passed: boolean) => {
    setState((prev) => {
      const next = { ...prev, sentQuizPassed: passed };
      persist(next);
      return next;
    });
  }, [persist]);

  const setWritingQuizPassed = useCallback((passed: boolean) => {
    setState((prev) => {
      const next = { ...prev, writingQuizPassed: passed };
      persist(next);
      return next;
    });
  }, [persist]);

  const addSentenceSpoken = useCallback((index: number) => {
    setState((prev) => {
      const sentencesSpoken = prev.sentencesSpoken.includes(index)
        ? prev.sentencesSpoken
        : [...prev.sentencesSpoken, index];
      const next = { ...prev, sentencesSpoken };
      persist(next);
      return next;
    });
  }, [persist]);

  const setFavoriteGames = useCallback((games: string[]) => {
    setState((prev) => {
      const next = { ...prev, favoriteGames: games };
      persist(next);
      return next;
    });
  }, [persist]);

  const setRewardGame = useCallback((game: string | null) => {
    setState((prev) => {
      const next = { ...prev, rewardGame: game };
      persist(next);
      return next;
    });
  }, [persist]);

  const startOver = useCallback(() => {
    const next: StoreState = {
      ...initialState,
      username: state.username,
      favoriteGames: state.favoriteGames,
    };
    persist(next);
  }, [state.username, state.favoriteGames, persist]);

  const value = {
    ...state,
    setUsername,
    setStage,
    setWord,
    setExampleSentences,
    setPronQuizPassed,
    setSentQuizPassed,
    setWritingQuizPassed,
    addSentenceSpoken,
    setFavoriteGames,
    setRewardGame,
    startOver,
  };

  return React.createElement(StoreContext.Provider, { value }, children);
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return context;
}
