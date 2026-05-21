import { motion, useReducedMotion } from "framer-motion";
import { ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function ScoreCard({
  score,
  gaps,
  reasoning,
  compact,
}: {
  score: number;
  gaps: string[];
  reasoning: string;
  compact?: boolean;
}) {
  const reduce = useReducedMotion();
  const variant =
    score >= 4 ? "good" : score >= 3 ? "mid" : ("low" as const);

  return (
    <motion.div
      className={cn("card overflow-hidden", compact ? "p-4" : "p-5")}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="flex gap-4">
        <div
          className={cn(
            "flex size-14 shrink-0 flex-col items-center justify-center rounded-xl font-display text-2xl font-bold tabular-nums",
            variant === "good" && "bg-score-good/15 text-score-good",
            variant === "mid" && "bg-accent-dim text-accent",
            variant === "low" && "bg-score-low/15 text-score-low",
          )}
        >
          {score}
          <span className="text-[10px] font-sans font-normal opacity-70">/5</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <ClipboardCheck className="size-3.5 text-on-muted" />
            <span className="text-xs font-semibold uppercase tracking-wider text-on-muted">
              Evaluator
            </span>
            <Badge variant={variant}>{score}/5</Badge>
          </div>
          {gaps[0] && (
            <p className="text-sm leading-relaxed text-on-surface">{gaps[0]}</p>
          )}
          {!compact && gaps.length > 1 && (
            <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-on-muted">
              {gaps.slice(1).map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          )}
          {!compact && reasoning && (
            <p className="mt-3 rounded-lg bg-surface-muted/80 px-3 py-2 text-xs leading-relaxed text-on-muted">
              {reasoning}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
