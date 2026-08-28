import { useEffect, useRef, useState } from "react";

export type VoiceState = "idle" | "playing" | "paused";

/**
 * Hook for Brazilian Portuguese (pt-BR) Text-to-Speech using the Web Speech API.
 * Handles iOS Safari / WebKit quirks, sentence chunking, and voice selection.
 */
export function useSentinelaVoice() {
  const [state, setState] = useState<VoiceState>("idle");
  const [supported, setSupported] = useState(true);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const chunksRef = useRef<string[]>([]);
  const currentChunkIndexRef = useRef(0);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Initialize and load available browser voices
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSupported(false);
      return;
    }

    const updateVoices = () => {
      const available = window.speechSynthesis.getVoices();
      if (available.length > 0) {
        setVoices(available);
      }
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;

    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Pick the best available Brazilian Portuguese voice
  function getBestPtBrVoice(): SpeechSynthesisVoice | null {
    if (voices.length === 0) return null;

    // 1. Exact match for pt-BR with high quality identifiers
    const ptBrVoices = voices.filter(
      (v) =>
        v.lang === "pt-BR" ||
        v.lang === "pt_BR" ||
        v.lang.toLowerCase().startsWith("pt-br") ||
        v.lang.toLowerCase().startsWith("pt_br"),
    );

    const naturalPtBr = ptBrVoices.find(
      (v) =>
        v.name.includes("Google") ||
        v.name.includes("Luciana") ||
        v.name.includes("Felipe") ||
        v.name.includes("Letícia") ||
        v.name.includes("Francisca") ||
        v.name.includes("Natural") ||
        v.name.includes("Premium"),
    );

    if (naturalPtBr) return naturalPtBr;
    if (ptBrVoices.length > 0) return ptBrVoices[0];

    // 2. Generic Portuguese fallback
    const ptVoices = voices.filter((v) => v.lang.startsWith("pt"));
    return ptVoices[0] || null;
  }

  function speakNextChunk() {
    if (!("speechSynthesis" in window)) return;

    if (currentChunkIndexRef.current >= chunksRef.current.length) {
      setState("idle");
      return;
    }

    const textChunk = chunksRef.current[currentChunkIndexRef.current];
    const utterance = new SpeechSynthesisUtterance(textChunk);
    utteranceRef.current = utterance;

    const voice = getBestPtBrVoice();
    if (voice) {
      utterance.voice = voice;
    }
    utterance.lang = "pt-BR";
    utterance.rate = 1.02; // Natural, clear cadence
    utterance.pitch = 1.0;

    utterance.onend = () => {
      currentChunkIndexRef.current += 1;
      speakNextChunk();
    };

    utterance.onerror = (e) => {
      // In Safari, cancel() triggers an error event with error === 'interrupted' or 'canceled'
      if (e.error !== "interrupted" && e.error !== "canceled") {
        console.warn("SpeechSynthesis error:", e);
      }
      if (currentChunkIndexRef.current + 1 < chunksRef.current.length) {
        currentChunkIndexRef.current += 1;
        speakNextChunk();
      } else {
        setState("idle");
      }
    };

    window.speechSynthesis.speak(utterance);
  }

  function speak(fullText: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    // Reset current speech
    window.speechSynthesis.cancel();

    // Clean and split text into manageable sentences to prevent iOS Safari cutoff
    const sentences = fullText
      .replace(/[*_#`~]/g, "") // remove markdown
      .split(/(?<=[.?!;])\s+|\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (sentences.length === 0) return;

    chunksRef.current = sentences;
    currentChunkIndexRef.current = 0;
    setState("playing");

    speakNextChunk();
  }

  function pause() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (state === "playing") {
      window.speechSynthesis.pause();
      setState("paused");
    }
  }

  function resume() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (state === "paused") {
      window.speechSynthesis.resume();
      setState("playing");
    }
  }

  function stop() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    currentChunkIndexRef.current = chunksRef.current.length;
    setState("idle");
  }

  return {
    state,
    supported,
    speak,
    pause,
    resume,
    stop,
  };
}
