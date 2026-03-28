"use client";

import { useState, useCallback } from "react";

interface SpeechRecorderProps {
  onResult: (transcript: string) => void;
  language?: string;
}

export default function SpeechRecorder({ onResult, language = "zh-CN" }: SpeechRecorderProps) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");

  const startRecording = useCallback(() => {
    setError("");
    setTranscript("");

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
    };

    recognition.onresult = (event: any) => {
      const result = event.results[0][0].transcript;
      setTranscript(result);
      onResult(result);
      setListening(false);
    };

    recognition.onerror = (event: any) => {
      setError(`Error: ${event.error}`);
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.start();
  }, [language, onResult]);

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={startRecording}
        disabled={listening}
        className={listening ? "btn-ghost opacity-60 cursor-not-allowed" : "btn-accent"}
      >
        {listening ? "Listening..." : "Start Recording"}
      </button>

      {error && (
        <div className="text-sm mt-1 text-red-500">{error}</div>
      )}
    </div>
  );
}
