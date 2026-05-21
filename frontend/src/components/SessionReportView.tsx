import type { SessionReport } from "@/api/types";
import { ScoreBadge } from "@/components/ScoreBadge";
import { MasteryTicks } from "@/components/MasteryTicks";

export function SessionReportView({ report }: { report: SessionReport }) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-on-muted">
        {report.evaluated_answers} answer
        {report.evaluated_answers === 1 ? "" : "s"} evaluated this session
      </p>

      {report.concepts.length > 0 && (
        <ul className="card divide-y divide-line overflow-hidden">
          {report.concepts.map((row) => (
            <li
              key={row.concept_id}
              className="flex items-center justify-between gap-4 px-5 py-4"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-on-surface">{row.name}</p>
                <p className="mt-0.5 font-mono text-xs text-on-muted">
                  {row.scores.length > 0 ? row.scores.join(" · ") : "—"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <MasteryTicks score={row.last_score} />
                <ScoreBadge score={row.last_score} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {report.narrative && (
        <blockquote className="card border-l-4 border-l-accent p-5 text-sm leading-relaxed text-on-muted italic">
          {report.narrative}
        </blockquote>
      )}
    </div>
  );
}
