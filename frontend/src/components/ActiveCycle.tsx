import { cn } from "@/lib/utils";
import { MessageContent } from "@/components/MessageContent";
import { EvaluatingSkeleton } from "@/components/Skeleton";
import type { CycleExchange } from "@/lib/cycles";

function Exchange({ exchange }: { exchange: CycleExchange }) {
  return (
    <div>
      {/* Question */}
      <MessageContent
        text={exchange.question}
        className="text-[16px] leading-[1.75] text-on-surface"
      />

      {/* Answer */}
      {exchange.answer && (
        <div className="mt-4 border-l-2 border-line/20 pl-4">
          <p className="text-[14px] leading-[1.7] text-on-surface/70">
            {exchange.answer}
          </p>
        </div>
      )}

      {/* Evaluation */}
      {exchange.eval && (
        <div className="mt-3 pl-4">
          <p className="text-[13px] leading-[1.65] text-on-muted/75">
            → {exchange.eval.reasoning}
          </p>
          {exchange.eval.score <= 2 && exchange.eval.gaps[0] && (
            <p className="mt-1.5 text-[12px] text-score-low/65">
              {exchange.eval.gaps[0]}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function ActiveCycle({
  conceptName,
  exchanges,
  currentQuestion,
  submitting = false,
  error,
}: {
  conceptName: string | null;
  exchanges: CycleExchange[];
  currentQuestion: string | null;
  submitting?: boolean;
  error?: string | null;
}) {
  const hasCurrentQuestion = !!currentQuestion;
  const lastExchange = exchanges.length > 0 ? exchanges[exchanges.length - 1] : null;
  const priorCount = exchanges.length - 1;

  if (!lastExchange && !hasCurrentQuestion) {
    return null;
  }

  return (
    <div>
      {/* Concept label */}
      {conceptName && (
        <p className="mb-5 text-[11px] uppercase tracking-widest text-on-muted/40">
          {conceptName}
        </p>
      )}

      {/* Prior exchange count — subtle, not the focus */}
      {priorCount > 0 && (
        <p className="mb-6 text-[11px] text-on-muted/25">
          {priorCount} earlier {priorCount === 1 ? "exchange" : "exchanges"} in this concept
        </p>
      )}

      {/* Only the most recent completed exchange */}
      {lastExchange && (
        <div className={cn(hasCurrentQuestion && "mb-10")}>
          <Exchange exchange={lastExchange} />
        </div>
      )}

      {/* Current question waiting for answer */}
      {hasCurrentQuestion && (
        <div
          className={cn(
            lastExchange && "border-t border-line/10 pt-8",
          )}
        >
          <MessageContent
            text={currentQuestion}
            className="text-[16px] leading-[1.75] text-on-surface"
          />
        </div>
      )}

      {/* Evaluating state — shown while waiting for score + next question */}
      {submitting && (
        <div className="mt-5">
          <EvaluatingSkeleton />
        </div>
      )}

      {error && (
        <p className="mt-3 text-xs text-score-low">{error}</p>
      )}
    </div>
  );
}
