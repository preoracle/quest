import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const SCENARIOS = [
  {
    topic: "JS Event Loop",
    question:
      "A Promise.then callback and a setTimeout(fn, 0) both resolve at the same time. Which runs first, and why?",
    answer:
      "The Promise callback. Microtasks — like Promise.then — are drained completely before the event loop advances to the next macrotask. setTimeout queues a macrotask, so it waits.",
    score: 5,
    scoreColor: "text-accent",
    scoreBg: "border-accent/25 bg-accent-dim/25",
    feedback:
      "Exact. After every macrotask the microtask queue is fully drained before any macrotask executes — which is why chained .then() calls all fire before any setTimeout.",
    followUp: "So if a .then callback queues another .then, does the event loop ever process other tasks between them?",
  },
  {
    topic: "SQL Indexes",
    question:
      "You have a composite index on (user_id, created_at). Will a query filtering only on created_at use this index?",
    answer:
      "No. Composite indexes are ordered by the leftmost column first. Without a user_id constraint, the DB can't use the ordered structure — it would scan the entire index.",
    score: 4,
    scoreColor: "text-score-good",
    scoreBg: "border-score-good/25 bg-score-good/8",
    feedback:
      "Right on the leftmost prefix rule. Precision: some engines (Postgres) may use a bitmap scan if selectivity is high enough. 'Can't use it' is too absolute — won't use it efficiently is more accurate.",
    followUp:
      "Given that, when would you deliberately put the higher-cardinality column second in a composite index?",
  },
] as const;

type Phase = "question" | "thinking" | "typing" | "scored" | "followup" | "exit";

const TYPING_MS = 36;
const THINK_MS  = 2200;
const SCORED_HOLD_MS = 2600;
const FOLLOWUP_HOLD_MS = 3400;
const EXIT_MS = 700;

export function HeroDemoCard() {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("question");
  const [typed, setTyped] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const s = SCENARIOS[idx];

  function tick(ms: number, next: () => void) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(next, ms);
  }

  useEffect(() => {
    if (phase === "question") tick(THINK_MS, () => setPhase("thinking"));
    if (phase === "thinking") tick(400, () => setPhase("typing"));
    if (phase === "scored")   tick(SCORED_HOLD_MS, () => setPhase("followup"));
    if (phase === "followup") tick(FOLLOWUP_HOLD_MS, () => setPhase("exit"));
    if (phase === "exit") tick(EXIT_MS, () => {
      setTyped("");
      setIdx((i) => (i + 1) % SCENARIOS.length);
      setPhase("question");
    });
    return () => { if (timer.current) clearTimeout(timer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, idx]);

  useEffect(() => {
    if (phase !== "typing") return;
    if (typed.length >= s.answer.length) {
      tick(500, () => setPhase("scored"));
      return;
    }
    const t = setTimeout(() => setTyped(s.answer.slice(0, typed.length + 1)), TYPING_MS);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, typed, s.answer]);

  const showAnswer = phase === "typing" || phase === "scored" || phase === "followup" || phase === "exit";
  const showScore  = phase === "scored" || phase === "followup" || phase === "exit";
  const showFollow = phase === "followup" || phase === "exit";

  return (
    <motion.div
      key={idx}
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="hero-demo-shadow relative w-full max-w-[27rem] overflow-hidden rounded-2xl border border-line/40 bg-surface/40 p-5 backdrop-blur-2xl"
    >
      {/* Glow */}
      <div className="pointer-events-none absolute -top-20 left-1/3 size-48 -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-12 right-0 size-32 rounded-full bg-indigo-500/6 blur-2xl" />

      {/* Header */}
      <div className="relative mb-4 flex items-center gap-2.5">
        <span className="rounded-full border border-accent/30 bg-accent-dim/40 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
          {s.topic}
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-on-muted/60">
          <span className="size-1.5 animate-pulse rounded-full bg-score-good" />
          Live session
        </span>
      </div>

      {/* Tutor question */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="relative mb-4 flex items-start gap-2.5"
      >
        <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[9px] font-bold text-on-muted">
          T
        </div>
        <p className="text-[13px] leading-relaxed text-on-surface">{s.question}</p>
      </motion.div>

      {/* Thinking indicator */}
      <AnimatePresence>
        {phase === "thinking" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mb-4 flex justify-end"
          >
            <div className="flex items-center gap-1 rounded-full border border-accent/15 bg-accent-dim/20 px-3 py-1.5">
              {[0, 0.15, 0.3].map((d) => (
                <span
                  key={d}
                  className="size-1.5 animate-bounce rounded-full bg-accent/60"
                  style={{ animationDelay: `${d}s` }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User answer */}
      <AnimatePresence>
        {showAnswer && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="relative mb-4 flex justify-end"
          >
            <div className="max-w-[90%]">
              <p className="mb-1 text-right text-[10px] font-semibold uppercase tracking-wider text-accent/55">
                You
              </p>
              <div className="rounded-2xl rounded-tr-sm border border-accent/15 bg-accent-dim/25 px-3.5 py-2.5">
                <p className="text-[13px] leading-relaxed text-on-surface/90">
                  {typed}
                  {phase === "typing" && (
                    <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-accent/70" />
                  )}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Evaluator score card */}
      <AnimatePresence>
        {showScore && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className={`relative mb-4 rounded-xl border px-4 py-3 ${s.scoreBg}`}
          >
            <div className="mb-2 flex items-center gap-2">
              <span className={`font-mono text-base font-bold ${s.scoreColor}`}>
                {s.score}/5
              </span>
              <span className="text-[10px] uppercase tracking-wider opacity-50">
                Evaluator
              </span>
              {/* Score dots */}
              <div className="ml-auto flex gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <span
                    key={n}
                    className={`size-1.5 rounded-full ${n <= s.score ? s.scoreColor.replace("text-", "bg-") : "bg-line/60"}`}
                  />
                ))}
              </div>
            </div>
            <p className="text-[12px] leading-relaxed opacity-80">{s.feedback}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tutor follow-up */}
      <AnimatePresence>
        {showFollow && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="flex items-start gap-2.5"
          >
            <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[9px] font-bold text-on-muted">
              T
            </div>
            <p className="text-[13px] leading-relaxed text-on-surface/80">
              {s.followUp}
              <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-accent/50" />
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
