import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, RotateCcw, Sparkles, TrendingUp } from "lucide-react";
import type { SessionView } from "@/api/types";
import { SessionReportView } from "@/components/SessionReportView";
import { Button } from "@/components/ui/button";

export function SessionCompletePanel({
  session,
  onStartFresh,
  startingFresh,
}: {
  session: SessionView;
  onStartFresh?: () => void;
  startingFresh?: boolean;
}) {
  const reduce = useReducedMotion();
  const evaluated = session.report?.evaluated_answers ?? 0;
  const isEmpty = evaluated === 0;
  const concepts = session.report?.concepts ?? [];

  const masteredThisSession = concepts.filter((c) => c.last_score >= 4).length;
  const conceptsWorked = concepts.length;
  const avgScore =
    concepts.length > 0
      ? concepts.reduce((sum, c) => sum + c.last_score, 0) / concepts.length
      : null;

  const stats = [
    {
      value: String(evaluated),
      label: "Questions answered",
      color: "text-on-surface",
    },
    {
      value: String(masteredThisSession),
      label: "Mastered this run",
      color: "text-score-good",
    },
    {
      value: avgScore !== null ? avgScore.toFixed(1) : "–",
      label: "Avg score / 5",
      color: "text-accent",
      suffix: avgScore !== null ? <TrendingUp className="size-3.5 opacity-60" /> : null,
    },
  ];

  return (
    <div className="space-y-8">
      <motion.div
        className="flex items-start gap-4"
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-score-good/15 text-score-good">
          <CheckCircle2 className="size-5" />
        </span>
        <div>
          <h1 className="font-display text-xl font-semibold text-on-surface">
            {isEmpty ? "Nothing to study right now" : "Session complete"}
          </h1>
          <p className="mt-1 text-sm text-on-muted">{session.topic_display}</p>
        </div>
      </motion.div>

      {!isEmpty && conceptsWorked > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {stats.map(({ value, label, color, suffix }, i) => (
            <motion.div
              key={label}
              className="flex flex-col gap-1 rounded-xl border border-line/40 bg-surface/20 px-4 py-3"
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.07, duration: 0.4 }}
            >
              <div className={`flex items-center gap-1 ${color}`}>
                <span className="font-mono text-2xl font-semibold tabular-nums">
                  {value}
                </span>
                {suffix}
              </div>
              <span className="text-xs text-on-muted">{label}</span>
            </motion.div>
          ))}
        </div>
      )}

      {isEmpty ? (
        <motion.div
          className="rounded-2xl border border-line/50 bg-surface/30 px-6 py-5 text-sm leading-relaxed text-on-muted"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <p>
            Every concept in this topic is already marked as mastered, or the
            scheduler has nothing due. That is why you landed here with no new
            questions.
          </p>
          <p className="mt-3">
            Start a{" "}
            <strong className="font-medium text-on-surface">fresh run</strong> to
            walk the map again, or pick another topic from review.
          </p>
        </motion.div>
      ) : session.report ? (
        <motion.div
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <SessionReportView report={session.report} />
        </motion.div>
      ) : (
        <p className="text-sm text-on-muted">{session.summary ?? "Well done."}</p>
      )}

      <motion.div
        className="flex flex-wrap gap-3"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
      >
        {onStartFresh && (
          <Button disabled={startingFresh} onClick={onStartFresh}>
            <RotateCcw className="size-4" />
            {startingFresh ? "Starting…" : "Fresh run"}
          </Button>
        )}
        <Button asChild variant={onStartFresh ? "outline" : "default"}>
          <Link to="/topics">
            <Sparkles className="size-4" />
            Topics
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/due">Review queue</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/mastery">Progress</Link>
        </Button>
      </motion.div>
    </div>
  );
}
