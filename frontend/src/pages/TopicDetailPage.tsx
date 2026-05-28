import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Play, RotateCcw } from "lucide-react";
import { fetchTopics, startSession } from "@/api/client";
import type { StartMode, TopicCatalogItem } from "@/api/types";
import { AppShell } from "@/components/AppShell";
import { PageLoader } from "@/components/PageLoader";
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
      <AppShell breadcrumb={[{ label: "Library", to: "/topics" }]}>
        <PageScaffold tier="reading">
          <PageLoader
            label="Loading thread"
            hint="Pulling your concepts, scores, and queue status."
          />
        </PageScaffold>
      </AppShell>
    );
  }

  if (!topic) {
    return (
      <AppShell breadcrumb={[{ label: "Library", to: "/topics" }]}>
        <PageScaffold tier="reading">
          <p className="text-sm text-score-low">{error ?? "Topic not found"}</p>
          <Link to="/topics" className="mt-4 inline-block text-sm text-accent">
            ← Library
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
        { label: "Library", to: "/topics" },
        { label: topic.display_name },
      ]}
    >
      <PageScaffold tier="reading">
        <div className={cn("flex flex-col", sectionGap)}>
        <div className="card overflow-hidden p-0">
          <div className="border-b border-line/50 bg-linear-to-br from-accent-dim/50 via-surface/20 to-transparent px-6 py-6">
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

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={starting}
            onClick={() => begin("replay")}
          >
            <RotateCcw className="size-4" />
            Fresh run
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to={`/baseline/${topic.id}`}>Baseline check</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to={`/mastery?topic=${encodeURIComponent(topic.id)}`}>See insights</Link>
          </Button>
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
