import { useState } from "react";
import type { TranscriptEntry } from "@/lib/transcript";
import { ScoreCard } from "@/components/ScoreCard";
import { cn } from "@/lib/utils";

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
    return (
      <ScoreCard
        score={score}
        gaps={gaps}
        reasoning={reasoning}
        compact={false}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="card w-full p-4 text-left transition-colors hover:border-accent/30"
    >
      <div className="flex items-center gap-3">
        <span className="font-display text-2xl font-bold tabular-nums text-accent">
          {score}
        </span>
        <span className="text-sm text-on-muted">
          {gaps[0] ?? "View feedback"}
        </span>
        <span className="ml-auto text-xs text-accent">Expand</span>
      </div>
    </button>
  );
}

export function TurnHistory({ entries }: { entries: TranscriptEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <div className="space-y-6">
      <h2 className="sticky top-0 z-10 bg-canvas/90 py-2 font-mono text-xs font-semibold uppercase tracking-widest text-on-muted backdrop-blur-sm">
        Earlier turns
      </h2>
      <div className="relative space-y-8 pl-4 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-line">
        {entries.map((entry) => {
          if (entry.kind === "tutor") {
            return (
              <div key={entry.id} className="relative">
                <span className="absolute -left-4 top-1.5 size-2 rounded-full bg-line ring-4 ring-canvas" />
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-on-muted">
                  Tutor asked
                </p>
                <p className="font-mono text-sm leading-relaxed text-on-muted line-clamp-2">
                  {entry.text}
                </p>
              </div>
            );
          }
          if (entry.kind === "user") {
            return (
              <div key={entry.id} className="relative">
                <span
                  className={cn(
                    "absolute -left-4 top-1.5 size-2 rounded-full ring-4 ring-canvas",
                    "bg-accent/60",
                  )}
                />
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-accent/80">
                  You answered
                </p>
                <p className="text-sm leading-relaxed text-on-surface/90 line-clamp-3">
                  {entry.text}
                </p>
              </div>
            );
          }
          return (
            <div key={entry.id} className="relative -ml-4">
              <CompactEval
                score={entry.score}
                gaps={entry.gaps}
                reasoning={entry.reasoning}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
