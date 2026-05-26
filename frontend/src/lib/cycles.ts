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
  if (score >= 5) return "Strong";
  if (score >= 4) return "Proficient";
  if (score >= 3) return "Developing";
  return "Needs work";
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
