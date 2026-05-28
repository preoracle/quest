import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { MessageContent } from "@/components/MessageContent";
import { masteryWord, scoreColor, scoreIcon, type CompletedCycle } from "@/lib/cycles";

function ExchangeBlock({ exchange }: { exchange: CompletedCycle["exchanges"][number] }) {
  return (
    <div>
      <MessageContent
        text={exchange.question}
        className="text-[13px] leading-[1.65] text-on-surface/80"
      />
      {exchange.answer && (
        <div className="mt-2.5 border-l-2 border-line/20 pl-3">
          <p className="text-[13px] leading-[1.65] text-on-surface/60">
            {exchange.answer}
          </p>
        </div>
      )}
      {exchange.eval && (
        <div className="mt-2 pl-3">
          <p className="text-[12px] leading-[1.6] text-on-muted/70">
            {exchange.eval.reasoning}
          </p>
          {exchange.eval.score <= 3 && exchange.eval.gaps.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {exchange.eval.gaps.map((gap, i) => (
                <li key={i} className="text-[11px] text-score-low/65">
                  ↳ {gap}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function CycleChip({
  cycle,
  expanded,
  onToggle,
}: {
  cycle: CompletedCycle;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-line/20 transition-colors",
        expanded ? "bg-surface/30" : "bg-surface/10 hover:bg-surface/20",
      )}
    >
      {/* Header row */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full cursor-pointer items-start gap-2 px-3 py-2.5 text-left"
      >
        <span className={cn("mt-px shrink-0 text-[11px]", scoreColor(cycle.finalScore), "opacity-70")}>
          {scoreIcon(cycle.finalScore)}
        </span>

        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium text-on-surface">
              {cycle.conceptName}
            </span>
            <span className={cn("text-xs opacity-60", scoreColor(cycle.finalScore))}>
              {masteryWord(cycle.finalScore)}
            </span>
          </div>
          {!expanded && cycle.summary && (
            <p className="mt-0.5 truncate text-xs text-on-muted/45">
              {cycle.summary}
            </p>
          )}
        </div>

        {expanded ? (
          <ChevronDown className="mt-0.5 size-3.5 shrink-0 text-on-muted/30" />
        ) : (
          <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-on-muted/30" />
        )}
      </button>

      {/* Expanded exchanges */}
      {expanded && (
        <div className="border-t border-line/15 px-3 pb-4 pt-3">
          <div className="space-y-6">
            {cycle.exchanges.map((exchange, i) => (
              <div key={exchange.id}>
                {i > 0 && <div className="mb-6 border-t border-line/10" />}
                <ExchangeBlock exchange={exchange} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
