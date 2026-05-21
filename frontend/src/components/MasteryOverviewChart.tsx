import type { TopicSummary } from "@/api/types";

export function MasteryOverviewChart({ topics }: { topics: TopicSummary[] }) {
  const started = topics.filter((t) => t.started);
  if (started.length === 0) return null;

  const max = 5;

  return (
    <section className="card p-6">
      <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-on-muted">
        Average score by topic
      </h2>
      <div className="mt-6 space-y-4">
        {started.map((t) => {
          const pct = (t.avg_score_1_to_5 / max) * 100;
          return (
            <div key={t.topic_id}>
              <div className="mb-1.5 flex justify-between text-sm">
                <span className="truncate font-medium text-on-surface">
                  {t.display_name}
                </span>
                <span className="font-mono tabular-nums text-on-muted">
                  {t.avg_score_1_to_5.toFixed(1)}/5
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent/70 to-accent transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
