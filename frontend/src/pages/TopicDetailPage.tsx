import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Gauge, Play, RotateCcw, TrendingUp } from "lucide-react";
import { fetchTopics, startSession } from "@/api/client";
import type { StartMode, TopicCatalogItem } from "@/api/types";
import { AppShell } from "@/components/AppShell";
import { PageScaffold } from "@/components/PageScaffold";
import { TopicManageActions } from "@/components/TopicManageActions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { sectionGap, sectionLabel } from "@/lib/layout";
import { cn, progressBarColor } from "@/lib/utils";

export function TopicDetailPage() {
  const { topicId } = useParams<{ topicId: string }>();
  const navigate = useNavigate();
  const [topic, setTopic] = useState<TopicCatalogItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    if (!topicId) return;
    setLoading(true);
    fetchTopics({ includeArchived: true })
      .then((rows) => {
        const found = rows.find((t) => t.id === topicId);
        setTopic(found ?? null);
        if (!found) setError("Topic not found");
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load topic"),
      )
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
  }, [topicId]);

  async function begin(mode: StartMode) {
    if (!topicId) return;
    setStarting(true);
    setError(null);
    try {
      let session = await startSession(topicId, mode);
      if (session.done && mode !== "replay") {
        session = await startSession(topicId, "resume");
      }
      if (session.done) {
        session = await startSession(topicId, "replay");
      }
      navigate(`/session/${session.session_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start session");
    } finally {
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <AppShell breadcrumb={[{ label: "Topics", to: "/topics" }]}>
        <PageScaffold tier="reading">
          <p className="text-sm text-on-muted">Loading…</p>
        </PageScaffold>
      </AppShell>
    );
  }

  if (!topic) {
    return (
      <AppShell breadcrumb={[{ label: "Topics", to: "/topics" }]}>
        <PageScaffold tier="reading">
          <p className="text-sm text-score-low">{error ?? "Topic not found"}</p>
          <Link to="/topics" className="mt-4 inline-block text-sm text-accent">
            ← Topics
          </Link>
        </PageScaffold>
      </AppShell>
    );
  }

  const progressPct =
    topic.concept_count > 0
      ? Math.round((topic.mastered_count / topic.concept_count) * 100)
      : 0;

  return (
    <AppShell
      breadcrumb={[
        { label: "Topics", to: "/topics" },
        { label: topic.display_name },
      ]}
    >
      <PageScaffold tier="reading">
        <div className={cn("flex flex-col", sectionGap)}>
        <div className="card overflow-hidden p-0">
          <div className="border-b border-line/50 bg-gradient-to-br from-accent-dim/50 via-surface/20 to-transparent px-6 py-6">
            <div className="flex flex-wrap gap-2">
              {topic.due_count > 0 && (
                <Badge variant="low">{topic.due_count} due for review</Badge>
              )}
              {topic.archived && <Badge variant="mid">Archived</Badge>}
              {topic.pinned && !topic.archived && (
                <Badge variant="mid">Pinned</Badge>
              )}
            </div>
            <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight text-on-surface">
              {topic.display_name}
            </h1>
            <p className="mt-3 max-w-prose text-sm leading-relaxed text-on-muted">
              {topic.hook}
            </p>
            <div className="mt-5 flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex justify-between text-xs text-on-muted">
                  <span>
                    {topic.mastered_count} of {topic.concept_count} mastered
                  </span>
                  <span className="font-mono tabular-nums">{progressPct}%</span>
                </div>
                <div
                  className="mt-2 h-2 overflow-hidden rounded-full bg-line/50"
                  role="progressbar"
                  aria-valuenow={progressPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className={cn(
                      "h-full rounded-full transition-colors",
                      topic.started
                        ? progressBarColor(topic.avg_score_1_to_5)
                        : "bg-accent/40",
                    )}
                    style={{ width: `${Math.max(progressPct, topic.started ? 4 : 0)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-5">
            <Button
              size="lg"
              className="w-full sm:w-auto"
              disabled={starting}
              onClick={() => begin("resume")}
            >
              <Play className="size-4" />
              {starting ? "Starting…" : topic.started ? "Continue studying" : "Start studying"}
            </Button>
            {error && (
              <p className="mt-3 text-sm text-score-low">{error}</p>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <ActionTile
            icon={RotateCcw}
            label="Fresh run"
            hint="Reset session flow"
            onClick={() => begin("replay")}
            disabled={starting}
          />
          <ActionTile
            icon={Gauge}
            label="Calibrate"
            hint="Quick baseline"
            href={`/baseline/${topic.id}`}
          />
          <ActionTile
            icon={TrendingUp}
            label="Progress"
            hint="Scores & mastery"
            href={`/mastery?topic=${encodeURIComponent(topic.id)}`}
          />
        </div>

        {topic.preview_concepts.length > 0 && (
          <section>
            <h2 className={sectionLabel}>Concepts in this topic</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {topic.preview_concepts.map((name) => (
                <li
                  key={name}
                  className="rounded-lg border border-line/40 bg-surface/25 px-3 py-2.5 text-sm text-on-muted"
                >
                  {name}
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="rounded-xl border border-line/40 bg-surface/20 px-5 py-5">
          <TopicManageActions
            id={topic.id}
            displayName={topic.display_name}
            archived={topic.archived}
            pinned={topic.pinned}
            deletable={topic.deletable}
            onChanged={() => navigate("/topics")}
          />
        </footer>
        </div>
      </PageScaffold>
    </AppShell>
  );
}

function ActionTile({
  icon: Icon,
  label,
  hint,
  href,
  onClick,
  disabled,
}: {
  icon: typeof Play;
  label: string;
  hint: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const className = cn(
    "flex flex-col gap-2 rounded-xl border border-line/45 bg-surface/25 p-4 text-left transition-colors",
    "hover:border-accent/25 hover:bg-surface/40",
    disabled && "pointer-events-none opacity-50",
  );

  const inner = (
    <>
      <Icon className="size-5 text-accent/90" strokeWidth={1.5} />
      <div>
        <p className="text-sm font-medium text-on-surface">{label}</p>
        <p className="mt-0.5 text-xs text-on-muted">{hint}</p>
      </div>
    </>
  );

  if (href) {
    return (
      <Link to={href} className={className}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" className={className} onClick={onClick} disabled={disabled}>
      {inner}
    </button>
  );
}
