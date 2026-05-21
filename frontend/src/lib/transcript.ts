import type { Evaluation, TurnItem } from "../api/types";

export type TranscriptEntry =
  | { id: string; kind: "tutor"; text: string }
  | { id: string; kind: "user"; text: string }
  | {
      id: string;
      kind: "eval";
      score: number;
      gaps: string[];
      reasoning: string;
    };

/** Build UI transcript from persisted turns. */
export function turnsToTranscript(turns: TurnItem[]): TranscriptEntry[] {
  const entries: TranscriptEntry[] = [];
  for (const t of turns) {
    if (t.role === "tutor") {
      entries.push({
        id: `t-${t.turn_idx}`,
        kind: "tutor",
        text: t.content,
      });
    } else {
      entries.push({
        id: `u-${t.turn_idx}`,
        kind: "user",
        text: t.content,
      });
      if (t.evaluator_score != null) {
        entries.push({
          id: `e-${t.turn_idx}`,
          kind: "eval",
          score: t.evaluator_score,
          gaps: t.evaluator_gaps ?? [],
          reasoning: t.evaluator_reasoning ?? "",
        });
      }
    }
  }
  return entries;
}

/** Append user answer, evaluation, and optional next tutor prompt after submit. */
export function appendTurnResult(
  entries: TranscriptEntry[],
  answer: string,
  evaluation: Evaluation | null,
  nextTutor: string | null,
  turnSeed: number,
): TranscriptEntry[] {
  const next = [...entries];
  next.push({ id: `u-live-${turnSeed}`, kind: "user", text: answer });
  if (evaluation) {
    next.push({
      id: `e-live-${turnSeed}`,
      kind: "eval",
      score: evaluation.score,
      gaps: evaluation.gaps,
      reasoning: evaluation.reasoning,
    });
  }
  if (nextTutor) {
    next.push({ id: `t-live-${turnSeed}`, kind: "tutor", text: nextTutor });
  }
  return next;
}

/** Separate completed turns from the active tutor prompt shown in the hero. */
export function splitActiveQuestion(
  entries: TranscriptEntry[],
  activeText: string | null | undefined,
): { history: TranscriptEntry[]; active: string | null } {
  if (!activeText) return { history: entries, active: null };
  const history = [...entries];
  const last = history[history.length - 1];
  if (last?.kind === "tutor" && last.text === activeText) {
    history.pop();
  }
  return { history, active: activeText };
}
