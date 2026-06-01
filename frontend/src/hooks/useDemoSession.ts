import { useCallback, useEffect, useRef, useState } from "react";

const CHAR_MS = 11;
const THINKING_MS = 1100;

export type DemoPhase = "idle" | "thinking" | "streaming" | "scored" | "followup";

export function useStreamText(text: string, active: boolean, charMs = CHAR_MS) {
  const [visible, setVisible] = useState("");
  const indexRef = useRef(0);

  useEffect(() => {
    indexRef.current = 0;
    setVisible("");
  }, [text]);

  useEffect(() => {
    if (!active) return;
    if (indexRef.current >= text.length) {
      setVisible(text);
      return;
    }
    const tick = () => {
      indexRef.current = Math.min(indexRef.current + 1, text.length);
      setVisible(text.slice(0, indexRef.current));
    };
    tick();
    const id = window.setInterval(tick, charMs);
    return () => window.clearInterval(id);
  }, [active, text, charMs]);

  return visible;
}

export function useDemoSession(feedback: string, followUp: string) {
  const [phase, setPhase] = useState<DemoPhase>("idle");

  const feedbackText = useStreamText(feedback, phase === "streaming");
  const followUpText = useStreamText(followUp, phase === "followup");

  const feedbackComplete = feedbackText.length >= feedback.length;
  const followUpComplete = followUpText.length >= followUp.length;

  const handleSend = useCallback(() => {
    if (phase !== "idle") return;
    setPhase("thinking");
  }, [phase]);

  const reset = useCallback(() => {
    setPhase("idle");
  }, []);

  // thinking → streaming
  useEffect(() => {
    if (phase !== "thinking") return;
    const id = window.setTimeout(() => setPhase("streaming"), THINKING_MS);
    return () => window.clearTimeout(id);
  }, [phase]);

  // streaming done → scored
  useEffect(() => {
    if (phase !== "streaming" || !feedbackComplete) return;
    const id = window.setTimeout(() => setPhase("scored"), 400);
    return () => window.clearTimeout(id);
  }, [phase, feedbackComplete]);

  // scored → followup
  useEffect(() => {
    if (phase !== "scored") return;
    const id = window.setTimeout(() => setPhase("followup"), 800);
    return () => window.clearTimeout(id);
  }, [phase]);

  return {
    phase,
    feedbackText,
    followUpText,
    feedbackComplete,
    followUpComplete,
    handleSend,
    reset,
    isIdle: phase === "idle",
    hasSent: phase !== "idle",
  };
}
