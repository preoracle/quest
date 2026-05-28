import type { TurnItem } from "@/api/types";

export interface CycleExchange {
  id: string;
  question: string;
  answer: string;
  eval: { score: number; gaps: string[]; reasoning: string } | null;
}

export interface CompletedCycle {
  id: string;
  conceptName: string;
  exchanges: CycleExchange[];
  finalScore: number;
  summary: string;
}

export function firstSentence(text: string): string {
  return (
    text.match(/^[^.!?]+[.!?]/)?.[0]?.trim() ?? text.slice(0, 120).trim()
  );
}

export function masteryWord(score: number): string {
  if (score >= 5) return "Mastered";
  if (score >= 4) return "Solid";
  if (score >= 3) return "Building";
  return "Keep going";
}

/** Colour class for a score — used by chips and indicators. */
export function scoreColor(score: number): string {
  if (score >= 4) return "text-score-good";
  if (score >= 3) return "text-score-mid";
  return "text-score-low";
}

/** Icon character for a completed cycle chip. */
export function scoreIcon(score: number): string {
  if (score >= 4) return "✓";
  if (score >= 3) return "→";
  return "↺";
}

/** Convert raw TurnItems (from a resumed session) into CycleExchange[]. */
export function buildExchangesFromTurns(turns: TurnItem[]): CycleExchange[] {
  const exchanges: CycleExchange[] = [];
  let pendingQuestion: string | null = null;

  for (const t of turns) {
    if (t.role === "tutor") {
      pendingQuestion = t.content;
    } else if (t.role === "user" && pendingQuestion !== null) {
      exchanges.push({
        id: `prior-${t.turn_idx}`,
        question: pendingQuestion,
        answer: t.content,
        eval:
          t.evaluator_score != null
            ? {
                score: t.evaluator_score,
                gaps: t.evaluator_gaps ?? [],
                reasoning: t.evaluator_reasoning ?? "",
              }
            : null,
      });
      pendingQuestion = null;
    }
  }

  return exchanges;
}
