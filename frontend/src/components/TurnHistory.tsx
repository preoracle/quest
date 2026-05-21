import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { TranscriptEntry } from "@/lib/transcript";
import { ScoreCard } from "@/components/ScoreCard";
import { MessageContent } from "@/components/MessageContent";

// ─── Data: group flat entries into Q→A→Eval clusters ────────────────────────

type TurnCluster = {
  id: string;
  question: string;
  answer: string | null;
  eval: { score: number; gaps: string[]; reasoning: string } | null;
};

function groupIntoClusters(entries: TranscriptEntry[]): TurnCluster[] {
  const clusters: TurnCluster[] = [];
  let pendingId: string | null = null;
  let pendingQ: string | null = null;
  let pendingA: string | null = null;

  for (const entry of entries) {
    if (entry.kind === "tutor") {
      if (pendingQ !== null) {
        clusters.push({ id: pendingId!, question: pendingQ, answer: pendingA, eval: null });
      }
      pendingId = entry.id;
      pendingQ = entry.text;
      pendingA = null;
    } else if (entry.kind === "user") {
      pendingA = entry.text;
    } else if (entry.kind === "eval") {
      if (pendingQ !== null) {
        clusters.push({
          id: pendingId!,
          question: pendingQ,
          answer: pendingA,
          eval: { score: entry.score, gaps: entry.gaps, reasoning: entry.reasoning },
        });
        pendingId = null;
        pendingQ = null;
        pendingA = null;
      }
    }
  }

  if (pendingQ !== null) {
    clusters.push({ id: pendingId!, question: pendingQ, answer: pendingA, eval: null });
  }

  return clusters;
}

function clusterOpacity(idx: number, total: number): number {
  const recency = total - 1 - idx;
  if (recency === 0) return 1;
  if (recency === 1) return 0.58;
  return 0.32;
}

// ─── Score dots animation ────────────────────────────────────────────────────

const DOTS_CONTAINER = {
  animate: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
};
const DOT_ANIM = {
  initial: { scale: 0, opacity: 0 },
  animate: {
    scale: 1,
    opacity: 1,
    transition: { type: "spring" as const, stiffness: 420, damping: 22 },
  },
};

// ─── Integrated feedback — lives inside the cluster ──────────────────────────

function IntegratedFeedback({
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

  const scoreColor =
    score >= 4 ? "text-score-good" : score >= 3 ? "text-accent" : "text-score-low";
  const dotColor =
    score >= 4 ? "bg-score-good" : score >= 3 ? "bg-accent" : "bg-score-low";
  const container =
    score >= 4
      ? "border-score-good/15 bg-score-good/5"
      : score >= 3
        ? "border-accent/15 bg-accent/5"
        : "border-score-low/15 bg-score-low/5";

  const firstSentence =
    reasoning.match(/^[^.!?]+[.!?]/)?.[0]?.trim().replace(/[.!?]$/, "") ??
    reasoning.slice(0, 100).trim();

  return (
    <div className={`relative overflow-hidden rounded-xl border ${container} px-4 py-3`}>
      {/* Shimmer on high score */}
      {score >= 4 && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.8, 0] }}
          transition={{ duration: 1.6, delay: 0.4 }}
          style={{
            background:
              "linear-gradient(135deg, rgb(212 168 83 / 0.18) 0%, transparent 60%)",
          }}
        />
      )}

      {/* Score + dots */}
      <div className="flex items-center gap-2.5">
        <span className={`font-mono text-sm font-bold ${scoreColor}`}>{score}/5</span>
        <motion.div
          className="flex gap-1"
          variants={DOTS_CONTAINER}
          initial="initial"
          animate="animate"
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <motion.span
              key={n}
              variants={DOT_ANIM}
              className={`size-2 rounded-full ${n <= score ? dotColor : "bg-line/50"}`}
            />
          ))}
        </motion.div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="ml-auto text-[11px] text-on-muted/35 transition-colors hover:text-on-muted/65"
        >
          Details →
        </button>
      </div>

      {/* Insight line — positive or nudge */}
      {score >= 3 && firstSentence && (
        <p
          className={`mt-2 text-[13px] leading-[1.65] ${
            score >= 4 ? "text-score-good/80" : "text-accent/80"
          }`}
        >
          ✓ {firstSentence}
        </p>
      )}
      {score <= 2 && gaps[0] && (
        <p className="mt-2 text-[13px] leading-[1.65] text-score-low/75">
          Consider: {gaps[0]}
        </p>
      )}
    </div>
  );
}

// ─── One learning cycle as a single visual unit ──────────────────────────────

function TurnClusterBlock({
  cluster,
  opacity,
}: {
  cluster: TurnCluster;
  opacity: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      style={{ opacity }}
      className="space-y-3.5 rounded-2xl border border-line/10 bg-surface/15 px-5 py-4"
    >
      {/* Tutor question */}
      <div className="flex items-start gap-3">
        <div className="mt-[3px] flex size-[22px] shrink-0 items-center justify-center rounded-full bg-line/70 text-[10px] font-bold text-on-muted">
          T
        </div>
        <MessageContent
          text={cluster.question}
          className="text-[15px] leading-[1.75] text-on-muted/80"
        />
      </div>

      {/* User answer */}
      {cluster.answer && (
        <div className="ml-[34px] rounded-xl rounded-tl-sm border border-accent/12 bg-accent-dim/20 px-4 py-3">
          <p className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-accent/45">
            You
          </p>
          <p className="text-[15px] leading-[1.75] text-on-surface/85">
            {cluster.answer}
          </p>
        </div>
      )}

      {/* Integrated evaluator feedback */}
      {cluster.eval && (
        <div className="ml-[34px]">
          <IntegratedFeedback
            score={cluster.eval.score}
            gaps={cluster.eval.gaps}
            reasoning={cluster.eval.reasoning}
          />
        </div>
      )}
    </motion.div>
  );
}

// ─── Export ──────────────────────────────────────────────────────────────────

export function TurnHistory({ entries }: { entries: TranscriptEntry[] }) {
  const clusters = useMemo(() => groupIntoClusters(entries), [entries]);

  if (clusters.length === 0) return null;

  return (
    <div className="space-y-3">
      {clusters.map((cluster, idx) => (
        <TurnClusterBlock
          key={cluster.id}
          cluster={cluster}
          opacity={clusterOpacity(idx, clusters.length)}
        />
      ))}
    </div>
  );
}
