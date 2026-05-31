import { useState } from "react";
import { cn } from "@/lib/utils";
import { MessageContent } from "@/components/MessageContent";
import { EvaluatingSkeleton } from "@/components/Skeleton";
import { masteryWord, scoreColor } from "@/lib/cycles";
import type { CycleExchange } from "@/lib/cycles";

/** Structured evaluation card — score + what you got right + gaps */
function EvalCard({
  eval: ev,
  onReEval,
}: {
  eval: NonNullable<CycleExchange["eval"]>;
  onReEval?: () => Promise<void>;
}) {
  const [reEvalPending, setReEvalPending] = useState(false);
  const tier = masteryWord(ev.score);
  const colorClass = scoreColor(ev.score);
  const isWeak = ev.score <= 3;

  // Split reasoning: first sentence as "what you got right" proxy, rest as detail
  const sentences = ev.reasoning.split(/(?<=[.!?])\s+/);
  const summary = sentences[0] ?? ev.reasoning;

  async function handleReEval() {
    if (!onReEval || reEvalPending) return;
    setReEvalPending(true);
    try {
      await onReEval();
    } finally {
      setReEvalPending(false);
    }
  }

  return (
    <div className="eval-card mt-4">
      {/* Score header */}
      <div className={cn("flex items-center gap-3 px-4 py-3 border-b border-line/30",
        ev.score >= 4 ? "bg-score-good/5" : ev.score >= 3 ? "bg-score-mid/5" : "bg-score-low/5"
      )}>
        <span className={cn("font-mono text-2xl font-bold tabular-nums leading-none", colorClass)}>
          {ev.score}
          <span className="text-sm font-normal text-on-muted/50">/5</span>
        </span>
        <div>
          <p className={cn("text-[13px] font-semibold leading-none", colorClass)}>{tier}</p>
          <p className="mt-0.5 text-[11px] text-on-muted/60 uppercase tracking-wide font-mono">
            Evaluation
          </p>
        </div>
      </div>

      {/* What you got right */}
      <div className="px-4 pt-3 pb-2">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-score-good/70">
          ✓ What you got right
        </p>
        <p className="text-[13px] leading-[1.65] text-on-surface/80">{summary}</p>
      </div>

      {/* Gaps — only when score ≤ 3 and gaps exist */}
      {isWeak && ev.gaps.length > 0 && (
        <div className="border-t border-line/20 px-4 pt-2.5 pb-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-score-low/70">
            △ Gaps to address
          </p>
          <ul className="space-y-1.5">
            {ev.gaps.map((gap, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] leading-[1.55] text-on-muted/80">
                <span className="mt-0.5 shrink-0 text-score-low/60">·</span>
                <span>{gap}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {ev.expert_framing && ev.score < 5 && (
        <div className="border-t border-line/20 px-4 pt-3 pb-3.5">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-accent/65">
            ◈ Expert framing
          </p>
          <p className="text-[13px] leading-[1.65] text-on-muted/80 italic">
            {ev.expert_framing}
          </p>
        </div>
      )}

      {/* Re-eval affordance — only on the most recent exchange */}
      {onReEval && (
        <div className="border-t border-line/15 px-4 py-2.5 flex justify-end">
          <button
            onClick={() => void handleReEval()}
            disabled={reEvalPending}
            className="text-[11px] text-on-muted/35 hover:text-on-muted/65 transition-colors disabled:opacity-40"
          >
            {reEvalPending ? "Re-evaluating…" : "↩ This missed my point"}
          </button>
        </div>
      )}
    </div>
  );
}

function Exchange({
  exchange,
  onReEval,
}: {
  exchange: CycleExchange;
  onReEval?: () => Promise<void>;
}) {
  return (
    <div>
      {/* Previous question — compact, de-emphasized */}
      <div className="question-hero">
        <MessageContent
          text={exchange.question}
          className="font-display text-[13px] leading-[1.65] text-on-muted/60 italic"
        />
      </div>

      {/* User's answer */}
      {exchange.answer && (
        <div className="mt-3 pl-5">
          <p className="text-[14px] leading-[1.75] text-on-surface/75 font-mono">
            {exchange.answer}
          </p>
        </div>
      )}

      {/* Structured evaluation — hidden on turns 1–2 and when overlay is showing */}
      {exchange.eval && !exchange.hideEval && <EvalCard eval={exchange.eval} onReEval={onReEval} />}
    </div>
  );
}

export function ActiveCycle({
  conceptName,
  exchanges,
  currentQuestion,
  submitting = false,
  error,
  onReEvalLast,
}: {
  conceptName: string | null;
  exchanges: CycleExchange[];
  currentQuestion: string | null;
  submitting?: boolean;
  error?: string | null;
  onReEvalLast?: () => Promise<void>;
}) {
  const hasCurrentQuestion = !!currentQuestion;
  const lastExchange = exchanges.length > 0 ? exchanges[exchanges.length - 1] : null;
  const priorCount = exchanges.length - 1;

  if (!lastExchange && !hasCurrentQuestion) {
    return null;
  }

  return (
    <div>
      {/* Concept label — exam section header feel */}
      {conceptName && (
        <p className="mb-6 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-accent/70">
          {conceptName}
        </p>
      )}

      {/* Prior exchange count — very subtle */}
      {priorCount > 0 && (
        <p className="mb-5 text-[11px] text-on-muted/25">
          {priorCount} earlier {priorCount === 1 ? "exchange" : "exchanges"} in this concept
        </p>
      )}

      {/* Most recent completed exchange — re-eval affordance attached */}
      {lastExchange && (
        <div className={cn(hasCurrentQuestion && "mb-12")}>
          <Exchange exchange={lastExchange} onReEval={onReEvalLast} />
        </div>
      )}

      {/* Current question — the hero element */}
      {hasCurrentQuestion && (
        <div className={cn(lastExchange && "border-t border-line/10 pt-10")}>
          <div className="question-hero">
            <MessageContent
              text={currentQuestion}
              className="font-display text-[22px] md:text-[24px] leading-[1.5] font-normal text-on-surface"
            />
          </div>
        </div>
      )}

      {/* Evaluating state */}
      {submitting && (
        <div className="mt-6">
          <EvaluatingSkeleton />
        </div>
      )}

      {error && (
        <p className="mt-3 text-xs text-score-low">{error}</p>
      )}
    </div>
  );
}
