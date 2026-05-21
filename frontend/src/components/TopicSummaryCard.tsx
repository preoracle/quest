import { Link } from "react-router-dom";
import type { TopicSummary } from "@/api/types";
import { ProgressRing } from "@/components/ProgressRing";
import { cn } from "@/lib/utils";

export function TopicSummaryCard({ topic }: { topic: TopicSummary }) {
  const pct =
    topic.concept_count > 0
      ? Math.round((topic.mastered_count / topic.concept_count) * 100)
      : 0;

  return (
    <Link
      to={`/mastery?topic=${encodeURIComponent(topic.topic_id)}`}
      className="card card-hover flex gap-4 p-5"
    >
      <div className="relative flex size-14 shrink-0 items-center justify-center">
        <ProgressRing value={pct} size={56} />
        <span className="absolute font-mono text-xs font-semibold tabular-nums text-on-surface">
          {pct}%
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-display text-lg font-semibold text-on-surface">
          {topic.display_name}
        </h3>
        <p className="mt-1 font-mono text-xs text-on-muted">{topic.topic_id}</p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-on-muted">
          <span>
            <span className={cn(topic.started ? "text-on-surface" : "")}>
              {topic.mastered_count}/{topic.concept_count}
            </span>{" "}
            mastered
          </span>
          {topic.avg_score_1_to_5 > 0 && (
            <span>Avg {topic.avg_score_1_to_5.toFixed(1)}/5</span>
          )}
          {topic.due_count > 0 && (
            <span className="text-accent">{topic.due_count} due</span>
          )}
        </div>
      </div>
    </Link>
  );
}
