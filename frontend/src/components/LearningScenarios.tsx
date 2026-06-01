import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useDemoSession } from "@/hooks/useDemoSession";
import { ScoreModal } from "@/components/ScoreModal";

type ScoreTier = "good" | "mid" | "low";

const SCENARIOS = [
  {
    id: "react-hooks",
    label: "React",
    topic: "React Internals",
    score: 5,
    scoreTier: "good" as ScoreTier,
    question:
      "Your component function runs again on every render. All local variables die. useState keeps its value. Explain the mechanism.",
    placeholder:
      "useState doesn't live inside your function. React's fiber reconciler maintains a linked list of hook states per component — outside the function entirely. Each useState call traverses this list by position. Your 'local' state actually lives in React's reconciler tree, not in your function scope.",
    feedback:
      "Exact on the fiber model. The sharper implication: this is why the Rules of Hooks exist. React identifies each hook call by its position in the list — not by name. Call useState inside a conditional and you corrupt the hook chain by shifting every subsequent call one slot. The rules aren't arbitrary — they're enforced by how the memory model actually works.",
    followUp:
      "If React identifies hooks by position in a list, what specifically breaks when you call useState inside an if statement that sometimes doesn't run?",
  },
  {
    id: "cap",
    label: "CAP Theorem",
    topic: "Distributed Systems",
    score: 3,
    scoreTier: "mid" as ScoreTier,
    question:
      "A partition doesn't ask your permission. What does that reveal about why the CAP trade-off is unavoidable — not just hard?",
    placeholder:
      "Because the system must respond before it knows whether the partition has healed. There's no third path: any response either risks stale data (available) or blocks indefinitely (consistent). Deferral isn't an option — it just relocates where the sacrifice happens.",
    feedback:
      "Strong framing. Worth sharpening: CAP's 'availability' means every non-failing node must return a response — not just stay online. The key insight: responding under uncertainty forces the choice immediately. Deferral moves where consistency is sacrificed; it doesn't eliminate the trade-off.",
    followUp:
      "If 'eventual consistency' is your answer, what specific claim does that make about how long the partition can last?",
  },
  {
    id: "dp",
    label: "Dynamic Programming",
    topic: "Dynamic Programming",
    score: 4,
    scoreTier: "good" as ScoreTier,
    question:
      "What two structural properties must a problem have for DP to work — and why does lacking either make DP incorrect, not just slower?",
    placeholder:
      "Overlapping subproblems and optimal substructure. Without overlapping subproblems, memoization saves nothing. Without optimal substructure, combining locally optimal solutions doesn't yield a globally optimal result. Apply DP anyway and you get fast, confidently wrong answers.",
    feedback:
      "Correct. Many people know memoization but miss optimal substructure. The distinction matters: DP doesn't just cache — it builds a solution by combining smaller optimal solutions. If that combination doesn't produce a global optimum, DP's foundational assumption fails silently. You get the wrong answer at O(n) instead of the wrong answer at O(2^n).",
    followUp:
      "Give a concrete example of a problem that appears to have optimal substructure but doesn't — where applying DP yields a fast, wrong result.",
  },
  {
    id: "indexes",
    label: "SQL Indexes",
    topic: "SQL Indexes",
    score: 4,
    scoreTier: "good" as ScoreTier,
    question:
      "You added an index. The query got slower. Explain exactly when a database actively chooses to ignore an index you created.",
    placeholder:
      "When traversal cost exceeds a sequential scan. A B-tree lookup plus a heap fetch for each matching row can cost more than reading the table linearly — especially for low-selectivity columns or small tables. The query planner estimates both paths and picks the cheaper one. Your index lost.",
    feedback:
      "Correct on the cost model. Sharper version: the heap fetch is the hidden killer — a non-covering index forces random I/O for each matching row, which beats sequential scan only when the index is highly selective. This is why EXPLAIN ANALYZE shows 'Seq Scan' even when an index exists. The planner did the math and your index didn't win.",
    followUp:
      "What makes a covering index different, and how does it eliminate the heap fetch that causes non-covering indexes to backfire on large reads?",
  },
] as const;

type ScenarioId = (typeof SCENARIOS)[number]["id"];

// y < 0 = card shifts UP into the 96px peek zone above the active card
const STACK_CONFIGS = [
  { rotate: 0,    x: 0,   y: 0,   scale: 1,    zIndex: 40, opacity: 1    },
  { rotate: 2.8,  x: 24,  y: -44, scale: 0.97, zIndex: 30, opacity: 1    },
  { rotate: -3.8, x: -20, y: -72, scale: 0.94, zIndex: 20, opacity: 0.95 },
  { rotate: 1.2,  x: 28,  y: -92, scale: 0.91, zIndex: 10, opacity: 0.75 },
];

function getDepth(cardIdx: number, activeIdx: number, total: number) {
  return (cardIdx - activeIdx + total) % total;
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 py-1">
      {[0, 160, 320].map((d) => (
        <span
          key={d}
          className="size-1.5 rounded-full bg-on-muted/40"
          style={{ animation: `quest-thinking-bounce 1.2s ease-in-out ${d}ms infinite` }}
        />
      ))}
    </div>
  );
}

// Back-of-deck cards — no blur (GPU), solid surface, clearly visible
function CardPeek({ scenario }: { scenario: (typeof SCENARIOS)[number] }) {
  return (
    <div className="flex h-full w-full flex-col rounded-xl border border-line/55 bg-surface-elevated p-5 shadow-[0_8px_32px_rgb(0_0_0/0.45)]">
      <div className="mb-4 flex items-center gap-2">
        <span className="size-1.5 rounded-full bg-on-muted/35" />
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-on-muted/50">
          {scenario.topic}
        </span>
      </div>
      <p className="font-display text-[13px] italic leading-relaxed text-on-muted/55 line-clamp-5">
        &ldquo;{scenario.question}&rdquo;
      </p>
    </div>
  );
}

function SessionWindow({
  scenario,
  onReset,
}: {
  scenario: (typeof SCENARIOS)[number];
  onReset: () => void;
}) {
  const [draft, setDraft] = useState("");
  const submittedRef = useRef("");

  const {
    phase,
    feedbackText,
    followUpText,
    feedbackComplete,
    followUpComplete,
    handleSend,
    isIdle,
    hasSent,
  } = useDemoSession(scenario.feedback, scenario.followUp);

  const onSend = useCallback(() => {
    submittedRef.current = draft.trim() || scenario.placeholder;
    handleSend();
  }, [draft, scenario.placeholder, handleSend]);

  const modalOpen =
    phase === "streaming" || phase === "scored" || phase === "followup";

  const charCount = draft.length;
  const hasTyped = charCount > 0;

  return (
    <>
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-line/50 bg-surface-elevated shadow-[0_20px_60px_rgb(0_0_0/0.45)]">
        {/* Header */}
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-line/30 px-5">
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-accent/55" />
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-accent/55">
              {scenario.topic}
            </span>
          </div>
          <button
            type="button"
            onClick={onReset}
            className={`font-mono text-[10px] text-on-muted/30 transition-colors hover:text-on-muted/60 ${
              hasSent ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
            aria-label="Reset demo"
          >
            reset ↺
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 min-h-0 flex-col gap-4 overflow-y-auto p-5">
          {/* Question in editorial serif */}
          <p className="font-display text-[13.5px] italic leading-relaxed text-on-surface">
            {scenario.question}
          </p>

          <AnimatePresence>
            {hasSent && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col gap-1.5"
              >
                <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-on-muted/35">
                  Your answer
                </p>
                <div className="rounded-xl border border-accent/12 bg-accent-dim/15 px-4 py-3">
                  <p className="text-[12.5px] leading-relaxed text-on-surface/85">
                    {submittedRef.current}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {phase === "thinking" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <TypingIndicator />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Input footer */}
        <div className="shrink-0 border-t border-line/25 p-4">
          <div
            className={`rounded-lg border p-3 transition-colors duration-300 ${
              isIdle
                ? "border-accent/18 bg-surface/40"
                : "border-line/18 bg-surface-muted/15"
            }`}
          >
            {isIdle ? (
              <>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={scenario.placeholder}
                  rows={3}
                  className="w-full resize-none bg-transparent text-[12px] leading-relaxed text-on-surface/85 placeholder:text-on-muted/28 outline-none"
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className={`font-mono text-[9px] transition-opacity duration-200 ${hasTyped ? "text-on-muted/40 opacity-100" : "opacity-0"}`}>
                    {charCount} chars
                  </span>
                  <div className="relative flex size-7 items-center justify-center">
                    <span
                      className="quest-send-cta-ring pointer-events-none absolute inset-0 rounded-full bg-accent"
                      aria-hidden
                    />
                    <button
                      type="button"
                      onClick={onSend}
                      aria-label="Submit answer"
                      className="quest-send-cta-pulse relative z-10 flex size-7 cursor-pointer items-center justify-center rounded-full bg-accent text-void transition-all duration-200 hover:brightness-110"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        aria-hidden
                      >
                        <line x1="12" y1="19" x2="12" y2="5" />
                        <polyline points="5 12 12 5 19 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-[12px] text-on-muted/28">Evaluating…</p>
            )}
          </div>
        </div>
      </div>

      <ScoreModal
        open={modalOpen}
        score={scenario.score}
        scoreTier={scenario.scoreTier}
        feedbackText={feedbackText}
        feedbackComplete={feedbackComplete}
        followUpText={followUpText}
        followUpComplete={followUpComplete}
        phase={modalOpen ? (phase as "streaming" | "scored" | "followup") : "streaming"}
        onClose={onReset}
      />
    </>
  );
}

function ScenarioWindowWrapper({
  scenario,
}: {
  scenario: (typeof SCENARIOS)[number];
}) {
  const [resetKey, setResetKey] = useState(0);
  const reset = useCallback(() => setResetKey((k) => k + 1), []);
  return (
    <SessionWindow
      key={`${scenario.id}-${resetKey}`}
      scenario={scenario}
      onReset={reset}
    />
  );
}

export function LearningScenarios() {
  const reduce = useReducedMotion();
  const [activeId, setActiveId] = useState<ScenarioId>("react-hooks");
  const activeIdx = SCENARIOS.findIndex((s) => s.id === activeId);

  return (
    <section className="border-y border-line/40 bg-canvas/60 px-gutter-app py-24">
      <div className="mx-auto max-w-3xl">
        {/* Section header */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-12"
        >
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-on-muted/38">
            Try a session
          </p>
          <h2 className="font-display text-[1.85rem] font-semibold leading-tight text-on-surface">
            Questions worth sitting with.
          </h2>
          <p className="mt-3 max-w-sm text-[0.9375rem] leading-relaxed text-on-muted">
            Type your own answer or use the example. Click any card behind to switch domains.
          </p>
        </motion.div>

        {/* Card deck */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1, duration: 0.5 }}
        >
          {/*
            96px top padding = peek zone.
            Cards are bottom-anchored at h-[400px] so negative-y
            translations expose them above the active card.
          */}
          <div className="relative" style={{ paddingTop: 96 }}>
            <div className="h-[400px] pointer-events-none" aria-hidden />

            {SCENARIOS.map((scenario, i) => {
              const depth = getDepth(i, activeIdx, SCENARIOS.length);
              const cfg = STACK_CONFIGS[depth];
              return (
                <motion.div
                  key={scenario.id}
                  className={`absolute left-0 right-0 bottom-0 h-[400px] ${depth > 0 ? "cursor-pointer" : ""}`}
                  animate={{
                    rotate: cfg.rotate,
                    x: cfg.x,
                    y: cfg.y,
                    scale: cfg.scale,
                    opacity: cfg.opacity,
                    zIndex: cfg.zIndex,
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 36, mass: 0.8 }}
                  style={{ transformOrigin: "50% 90%", willChange: "transform" }}
                  onClick={depth > 0 ? () => setActiveId(scenario.id) : undefined}
                >
                  {depth === 0 ? (
                    <ScenarioWindowWrapper scenario={scenario} />
                  ) : (
                    <CardPeek scenario={scenario} />
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Topic navigation */}
          <div className="mt-8 flex items-center justify-center gap-7">
            {SCENARIOS.map((s, i) => {
              const depth = getDepth(i, activeIdx, SCENARIOS.length);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveId(s.id)}
                  className={`font-mono text-[10px] uppercase tracking-[0.15em] transition-colors duration-200 ${
                    depth === 0
                      ? "text-accent"
                      : "text-on-muted/30 hover:text-on-muted/60"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
