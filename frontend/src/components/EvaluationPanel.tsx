import type { Evaluation } from "../api/types";
import { MasteryBar } from "./MasteryBar";

export function EvaluationPanel({ evaluation }: { evaluation: Evaluation }) {
  return (
    <aside className="border border-outline-variant bg-surface-container-high p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <span className="font-mono text-xs font-semibold uppercase tracking-widest text-primary">
          Last synthesis
        </span>
        <MasteryBar score={evaluation.score} />
      </div>
      {evaluation.gaps.length > 0 && (
        <ul className="mt-4 space-y-2 font-mono text-sm text-on-surface-variant">
          {evaluation.gaps.map((gap) => (
            <li key={gap} className="border-l border-outline-variant pl-3">
              {gap}
            </li>
          ))}
        </ul>
      )}
      {evaluation.reasoning && (
        <p className="mt-4 text-sm leading-relaxed text-on-surface-variant">
          {evaluation.reasoning}
        </p>
      )}
    </aside>
  );
}
