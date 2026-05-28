import { motion, AnimatePresence } from "framer-motion";
import { ProgressRing } from "@/components/ProgressRing";
import { masteryWord } from "@/lib/cycles";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RevealData {
  score: number;
  gaps: string[];
  reasoning: string;
  expert_framing?: string | null;
  conceptName: string | null;
  /** true = concept finished, moving to a new one */
  conceptComplete?: boolean;
  nextConceptName?: string | null;
}

function scoreRingColor(score: number): string {
  if (score >= 4) return "text-score-good";
  if (score >= 3) return "text-score-mid";
  return "text-score-low";
}

function scoreBg(score: number): string {
  if (score >= 4) return "from-score-good/8 via-transparent";
  if (score >= 3) return "from-score-mid/8 via-transparent";
  return "from-score-low/8 via-transparent";
}

export function ScoreReveal({
  data,
  onDismiss,
}: {
  data: RevealData | null;
  onDismiss: () => void;
}) {
  return (
    <AnimatePresence>
      {data && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 z-30 flex items-center justify-center bg-void/92"
          onClick={onDismiss}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 8 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "relative w-full max-w-md mx-5 rounded-2xl border border-line/50 overflow-hidden",
              "bg-linear-to-b", scoreBg(data.score),
              "bg-surface-elevated shadow-[0_24px_80px_rgb(0_0_0/0.6)]"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Score header */}
            <div className="flex items-center gap-5 px-6 pt-6 pb-5">
              <div className="relative shrink-0">
                <ProgressRing
                  value={(data.score / 5) * 100}
                  size={72}
                  stroke={5}
                  className={scoreRingColor(data.score)}
                />
                {/* Score number centered in the ring */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.span
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.15, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className={cn("font-mono text-2xl font-bold leading-none tabular-nums", scoreRingColor(data.score))}
                  >
                    {data.score}
                  </motion.span>
                </div>
              </div>

              <div className="min-w-0">
                {data.conceptName && (
                  <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-on-muted/50">
                    {data.conceptName}
                  </p>
                )}
                <motion.p
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1, duration: 0.25 }}
                  className={cn("font-display text-2xl font-semibold leading-none", scoreRingColor(data.score))}
                >
                  {masteryWord(data.score)}
                </motion.p>
                <p className="mt-1 font-mono text-[11px] text-on-muted/50 uppercase tracking-wide">
                  {data.score}/5 · Evaluation
                </p>
              </div>
            </div>

            <div className="border-t border-line/25" />

            {/* What you got right */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.25 }}
              className="px-6 pt-4 pb-3"
            >
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-score-good/70">
                ✓ What you got right
              </p>
              <p className="text-[14px] leading-[1.65] text-on-surface/85">
                {data.reasoning.split(/(?<=[.!?])\s+/)[0] ?? data.reasoning}
              </p>
            </motion.div>

            {/* Gaps — only if score ≤ 3 */}
            {data.score <= 3 && data.gaps.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.24, duration: 0.25 }}
                className="border-t border-line/20 px-6 pt-3.5 pb-3"
              >
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-score-low/70">
                  △ Gaps to address
                </p>
                <ul className="space-y-1.5">
                  {data.gaps.map((g, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] leading-[1.55] text-on-muted/80">
                      <span className="mt-0.5 shrink-0 text-score-low/55">·</span>
                      <span>{g}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}

            {data.expert_framing && data.score < 5 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.27, duration: 0.25 }}
                className="border-t border-line/20 px-6 pt-3 pb-3"
              >
                <p className="mb-2 text-[11px] uppercase tracking-widest text-accent/65">
                  ◈ Expert framing
                </p>
                <p className="text-[13px] leading-[1.65] text-on-muted/80 italic">
                  {data.expert_framing}
                </p>
              </motion.div>
            )}

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.2 }}
              className="border-t border-line/20 px-6 py-4 flex items-center justify-between gap-3"
            >
              <p className="text-[12px] text-on-muted/50">
                {data.conceptComplete && data.nextConceptName
                  ? `Next: ${data.nextConceptName}`
                  : data.conceptComplete
                  ? "Moving on…"
                  : "Keep going on this concept"}
              </p>
              <Button size="sm" onClick={onDismiss}>
                {data.conceptComplete ? "Next concept" : "Continue"}
                <ArrowRight className="size-3.5" />
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export type { RevealData };
