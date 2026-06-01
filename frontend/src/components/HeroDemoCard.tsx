import { motion, useReducedMotion } from "framer-motion";

function GhostCard({ topic, question }: { topic: string; question: string }) {
  return (
    <div className="h-full w-full rounded-2xl border border-line/50 bg-surface-elevated p-6 shadow-[0_6px_28px_rgb(0_0_0/0.4)]">
      <div className="mb-4 flex items-center gap-2">
        <span className="size-1.5 rounded-full bg-on-muted/30" />
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-on-muted/40">
          {topic}
        </span>
      </div>
      <p className="font-display text-[12.5px] italic leading-relaxed text-on-muted/45 line-clamp-4">
        &ldquo;{question}&rdquo;
      </p>
    </div>
  );
}

function ActiveCard() {
  return (
    <div className="flex h-full w-full flex-col rounded-2xl border border-line/55 bg-surface-elevated p-6 shadow-[0_24px_60px_rgb(0_0_0/0.55)]">
      {/* Metadata */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="size-1.5 animate-pulse rounded-full bg-accent" />
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-accent/60">
            React Internals · depth&nbsp;7
          </span>
        </div>
        <span className="font-mono text-[9px] text-on-muted/25">12 of 31</span>
      </div>

      {/* Question */}
      <p className="font-display mb-5 text-[14.5px] italic leading-[1.6] text-on-surface">
        &ldquo;Your component rerenders. All variables die. useState
        remembers. How?&rdquo;
      </p>

      {/* Rule */}
      <div className="mb-4 h-px w-full bg-line/25" />

      {/* Answer */}
      <div className="flex-1">
        <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-on-muted/35">
          Your answer
        </p>
        <p className="text-[12.5px] leading-relaxed text-on-surface/80">
          useState doesn&apos;t live in your component. React&apos;s fiber
          keeps a{" "}
          <span className="text-accent">hook list outside the function</span>{" "}
          — state persists in the reconciler&apos;s tree, not your scope.
          Each render traverses the list by position.
        </p>
      </div>

      {/* Score */}
      <div className="flex items-center gap-2.5 border-t border-line/20 pt-4">
        <div className="flex gap-[3px]">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className="size-1.5 rounded-full bg-score-good" />
          ))}
        </div>
        <span className="font-mono text-[11px] font-semibold text-score-good">
          5 / 5
        </span>
        <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.16em] text-on-muted/28">
          Evaluated
        </span>
      </div>
    </div>
  );
}

export function HeroDemoCard() {
  const reduce = useReducedMotion();

  return (
    <div className="relative h-[368px] w-[284px]" aria-hidden>
      {/* Back card */}
      <motion.div
        className="absolute inset-0"
        style={{ zIndex: 10, transformOrigin: "50% 88%" }}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1, rotate: -5.5, x: -14, y: 18 }}
        transition={{ delay: 0.7, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      >
        <GhostCard
          topic="Distributed Systems"
          question="Two nodes can't talk. Both are running. A user queries Node B. What are Node B's only options — and why are all of them bad?"
        />
      </motion.div>

      {/* Middle card */}
      <motion.div
        className="absolute inset-0"
        style={{ zIndex: 20, transformOrigin: "50% 88%" }}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1, rotate: 3.5, x: 18, y: 9 }}
        transition={{ delay: 0.75, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      >
        <GhostCard
          topic="SQL Indexes"
          question="You added an index. The query got slower. Explain exactly when a database actively chooses to ignore an index you created."
        />
      </motion.div>

      {/* Front card */}
      <motion.div
        className="absolute inset-0"
        style={{ zIndex: 30 }}
        initial={reduce ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <ActiveCard />
      </motion.div>
    </div>
  );
}
