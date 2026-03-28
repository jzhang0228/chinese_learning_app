"use client";

import { useState } from "react";

interface AudioPlayerProps {
  text: string;
}

export default function AudioPlayer({ text }: AudioPlayerProps) {
  const [playing, setPlaying] = useState(false);

  const play = () => {
    if (playing) return;

    // Try Web Speech API first (most reliable)
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "zh-CN";
      utterance.rate = 0.9;
      utterance.onstart = () => setPlaying(true);
      utterance.onend = () => setPlaying(false);
      utterance.onerror = () => setPlaying(false);
      window.speechSynthesis.speak(utterance);
      return;
    }

    // Fallback to TTS API
    setPlaying(true);
    const audio = new Audio(`/api/tts?text=${encodeURIComponent(text)}`);
    audio.onended = () => setPlaying(false);
    audio.onerror = () => setPlaying(false);
    audio.play().catch(() => setPlaying(false));
  };

  return (
    <button
      onClick={play}
      disabled={playing}
      className="btn-primary text-sm py-2 px-4 disabled:opacity-50"
    >
      {playing ? "Playing..." : "Play Audio"}
    </button>
  );
}
