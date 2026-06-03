import { useCallback, useEffect, useRef, useState } from "react";

// Chrome hard-cuts utterances at ~250 chars; 220 is a safe margin.
const MAX_CHARS = 220;

/**
 * Browser speechSynthesis wrapper for the tutor's spoken questions.
 * Mirrors the shape of useSpeechToText so callers are symmetric.
 *
 * Upgrade path: swap speak() internals to Deepgram Aura WebSocket —
 * the returned interface stays identical, callers need zero changes.
 */
export function useTextToSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    utteranceRef.current = null;
  }, []);

  const speak = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text.slice(0, MAX_CHARS));
    utter.rate = 0.92;
    utter.pitch = 1.0;
    utter.lang = "en-US";
    utter.onstart = () => setSpeaking(true);
    utter.onend = () => {
      setSpeaking(false);
      utteranceRef.current = null;
    };
    utter.onerror = () => {
      setSpeaking(false);
      utteranceRef.current = null;
    };

    utteranceRef.current = utter;
    window.speechSynthesis.speak(utter);
  }, []);

  return { supported, speaking, speak, stop };
}
