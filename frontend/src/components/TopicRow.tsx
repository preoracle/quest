import { Link } from "react-router-dom";
import { BookmarkMinus, BookmarkPlus, ChevronRight, Play } from "lucide-react";
import type { TopicCatalogItem } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, progressBarColor } from "@/lib/utils";

interface TopicRowProps {
  topic: TopicCatalogItem;
  busy: boolean;
  onContinue: () => void;
  onToggleEnroll?: () => void;
  enrollBusy?: boolean;
}

/** Catalog row — single band: content + actions aligned center. */
export function TopicRow({ topic, busy, onContinue, onToggleEnroll, enrollBusy }: TopicRowProps) {
  const progressPct =
    topic.concept_count > 0
      ? Math.round((topic.mastered_count / topic.concept_count) * 100)
      : 0;

  return (
    <article
      className={cn(
        "group flex items-center gap-3 rounded-xl border border-line/45 bg-surface/25 py-2.5 pl-4 pr-3 transition-colors",
        "hover:border-accent/20 hover:bg-surface/40",
        busy && "pointer-events-none opacity-60",
      )}
    >
      <Link
        to={`/topics/${topic.id}`}
        className="min-w-0 flex-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
      >
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate font-display text-[15px] font-semibold text-on-surface">
            {topic.display_name}
          </h2>
          {topic.due_count > 0 && (
            <Badge variant="low" className="shrink-0">
              {topic.due_count} due
            </Badge>
          )}
          {topic.pinned && !topic.archived && (
            <Badge variant="mid" className="shrink-0">
              Pinned
            </Badge>
          )}
        </div>
        <p className="mt-0.5 line-clamp-1 text-sm leading-snug text-on-muted">
          {topic.hook}
        </p>
        <div className="mt-1 flex items-center gap-3">
          <span className="shrink-0 text-xs text-on-muted/75">
            {topic.concept_count} concepts
            {topic.started ? ` · ${progressPct}%` : ""}
          </span>
          {topic.started && topic.concept_count > 0 && (
            <div
              className="h-1 min-w-0 flex-1 max-w-28 overflow-hidden rounded-full bg-line/60"
              role="progressbar"
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={cn("h-full rounded-full transition-colors", progressBarColor(topic.avg_score_1_to_5))}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}
        </div>
      </Link>

      <div className="flex shrink-0 items-center gap-1.5">
        {onToggleEnroll && (
          <button
            type="button"
            disabled={enrollBusy}
            onClick={(e) => { e.preventDefault(); onToggleEnroll(); }}
            className={cn(
              "flex size-8 items-center justify-center rounded-lg transition-colors",
              "disabled:pointer-events-none disabled:opacity-40",
              topic.enrolled
                ? "text-accent hover:bg-accent/10"
                : "text-on-muted hover:bg-surface-muted hover:text-accent",
            )}
            aria-label={topic.enrolled ? "Remove from my topics" : "Add to my topics"}
            title={topic.enrolled ? "Remove from my topics" : "Add to my topics"}
          >
            {topic.enrolled
              ? <BookmarkMinus className="size-4" />
              : <BookmarkPlus className="size-4" />}
          </button>
        )}
        <Button
          size="sm"
          disabled={busy}
          className="h-8 min-w-[5.5rem] px-3"
          onClick={(e) => {
            e.preventDefault();
            onContinue();
          }}
        >
          <Play className="size-3.5" />
          {busy ? "…" : topic.started ? "Continue" : "Start"}
        </Button>
        <Link
          to={`/topics/${topic.id}`}
          className="flex size-8 items-center justify-center rounded-lg text-on-muted transition-colors hover:bg-surface-muted hover:text-accent"
          aria-label={`Open ${topic.display_name}`}
        >
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </article>
  );
}
