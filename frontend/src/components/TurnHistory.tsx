import { useState } from "react";
import { motion } from "framer-motion";
import type { TranscriptEntry } from "@/lib/transcript";
import { ScoreCard } from "@/components/ScoreCard";

function CompactEval({
  score,
  gaps,
  reasoning,
}: {
  score: number;
  gaps: string[];
  reasoning: string;
}) {
  const [open, setOpen] = useState(false);

  if (open) {
    return <ScoreCard score={score} gaps={gaps} reasoning={reasoning} compact={false} />;
  }

  const color =
    score >= 4 ? "text-score-good border-score-good/20 bg-score-good/8"
    : score >= 3 ? "text-accent border-accent/20 bg-accent-dim/40"
    : "text-score-low border-score-low/20 bg-score-low/8";

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={`w-full rounded-xl border px-3.5 py-2.5 text-left text-sm transition-opacity hover:opacity-90 ${color}`}
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs font-semibold">{score}/5</span>
        <span className="text-[10px] uppercase tracking-wider opacity-70">Evaluator</span>
      </div>
      {gaps[0] && (
        <p className="mt-1 line-clamp-1 text-xs opacity-80">{gaps[0]}</p>
      )}
    </button>
  );
}

function groupOpacity(evalIndex: number, totalEvals: number): number {
  if (totalEvals <= 1) return 1;
  const recency = totalEvals - 1 - evalIndex;
  if (recency === 0) return 0.88;
  if (recency === 1) return 0.55;
  return 0.35;
}

export function TurnHistory({ entries }: { entries: TranscriptEntry[] }) {
  if (entries.length === 0) return null;

  const totalEvals = entries.filter((e) => e.kind === "eval").length;
  let currentEvalIdx = -1;
  const evalGroupMap = new Map<string, number>();
  for (const entry of entries) {
    if (entry.kind === "eval") {
      currentEvalIdx++;
      evalGroupMap.set(entry.id, currentEvalIdx);
    }
  }

  let assignedGroup = 0;
  const entryGroup = new Map<string, number>();
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e.kind === "eval") assignedGroup = evalGroupMap.get(e.id) ?? 0;
    entryGroup.set(e.id, assignedGroup);
  }

  return (
    <div className="space-y-3">
      {entries.map((entry, idx) => {
        const group = entryGroup.get(entry.id) ?? 0;
        const opacity = groupOpacity(group, totalEvals);

        if (entry.kind === "tutor") {
          return (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.02 }}
              className="flex items-start gap-2.5"
              style={{ opacity }}
            >
              <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-line text-[9px] font-bold tracking-tight text-on-muted">
                T
              </div>
              <div className="min-w-0 flex-1">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-on-muted/50">
                  Tutor
                </p>
                <p className="line-clamp-2 text-sm leading-relaxed text-on-muted">
                  {entry.text}
                </p>
              </div>
            </motion.div>
          );
        }

        if (entry.kind === "user") {
          return (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.02 }}
              className="flex justify-end"
              style={{ opacity }}
            >
              <div className="max-w-[80%]">
                <p className="mb-1 text-right text-[10px] font-semibold uppercase tracking-wider text-accent/60">
                  You
                </p>
                <div className="rounded-2xl rounded-tr-sm border border-accent/15 bg-accent-dim/30 px-3.5 py-2.5">
                  <p className="line-clamp-3 text-sm leading-relaxed text-on-surface/90">
                    {entry.text}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        }

        return (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.02 }}
            style={{ opacity }}
          >
            <CompactEval
              score={entry.score}
              gaps={entry.gaps}
              reasoning={entry.reasoning}
            />
          </motion.div>
        );
      })}
    </div>
  );
}
