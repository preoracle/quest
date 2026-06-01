import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

type ScoreTier = "good" | "mid" | "low";

const SCORE_STYLES: Record<ScoreTier, { text: string; dot: string; ring: string }> = {
  good: { text: "text-score-good", dot: "bg-score-good", ring: "border-score-good/30 bg-score-good/8" },
  mid:  { text: "text-score-mid",  dot: "bg-score-mid",  ring: "border-score-mid/30 bg-score-mid/8"   },
  low:  { text: "text-score-low",  dot: "bg-score-low",  ring: "border-score-low/30 bg-score-low/8"   },
};

function ScoreDots({ count, tier }: { count: number; tier: ScoreTier }) {
  const styles = SCORE_STYLES[tier];
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={`size-2 rounded-full ${i < count ? styles.dot : "bg-line/40"}`}
          style={{
            animation: i < count
              ? `quest-score-dot-in 0.3s cubic-bezier(0.34,1.56,0.64,1) ${i * 70}ms both`
              : undefined,
          }}
        />
      ))}
    </div>
  );
}

interface ScoreModalProps {
  open: boolean;
  score: number;
  scoreTier: ScoreTier;
  feedbackText: string;
  feedbackComplete: boolean;
  followUpText: string;
  followUpComplete: boolean;
  phase: "streaming" | "scored" | "followup";
  onClose: () => void;
}

export function ScoreModal({
  open,
  score,
  scoreTier,
  feedbackText,
  feedbackComplete,
  followUpText,
  followUpComplete,
  phase,
  onClose,
}: ScoreModalProps) {
  const styles = SCORE_STYLES[scoreTier];
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const modal = (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={overlayRef}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-void/70 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />

          {/* Modal panel */}
          <motion.div
            className="relative z-10 w-full max-w-[520px] overflow-hidden rounded-2xl border border-line/50 bg-surface shadow-[0_24px_80px_rgb(0_0_0/0.6)]"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Header */}
            <div className="flex h-11 items-center justify-between border-b border-line/40 px-5">
              <div className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-on-muted/30" />
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-on-muted/50">
                  Evaluator
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex size-7 items-center justify-center rounded-md text-on-muted/40 transition-colors hover:bg-surface-muted hover:text-on-muted"
                aria-label="Close"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-6 sm:p-8">
              {/* Score row */}
              <div className={`mb-5 flex items-center gap-3 rounded-xl border px-4 py-3 ${styles.ring}`}>
                <span className={`font-mono text-xl font-bold ${styles.text}`}>
                  {score}/5
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-on-muted/50">
                  Score
                </span>
                <div className="ml-auto">
                  <ScoreDots count={score} tier={scoreTier} />
                </div>
              </div>

              {/* Feedback */}
              <div className="mb-5 min-h-[3rem]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-on-muted/50 mb-2">
                  Feedback
                </p>
                <p className="text-[14px] leading-relaxed text-on-muted">
                  {feedbackText}
                  {!feedbackComplete && (
                    <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-accent/60 align-middle" />
                  )}
                </p>
              </div>

              {/* Follow-up */}
              <AnimatePresence>
                {(phase === "scored" || phase === "followup") && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mb-6 rounded-xl border border-line/40 bg-surface-elevated/60 px-4 py-3.5"
                  >
                    <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-on-muted/40">
                      Follow-up
                    </p>
                    <p className="text-[13px] leading-relaxed text-on-surface/85">
                      {followUpText}
                      {phase === "followup" && !followUpComplete && (
                        <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-accent/50 align-middle" />
                      )}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action */}
              <button
                type="button"
                onClick={onClose}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-void transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0"
              >
                Continue
                <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}
