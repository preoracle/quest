import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import {
  fetchDue,
  fetchMastery,
  fetchProgressSummary,
  fetchTopicGraph,
} from "@/api/client";
import type { MasteryItem, TopicGraph, TopicSummary } from "@/api/types";
import { AppShell } from "@/components/AppShell";
import { ConceptGraph } from "@/components/ConceptGraph";
import { PageScaffold } from "@/components/PageScaffold";
import { MasteryTicks } from "@/components/MasteryTicks";
import { Button } from "@/components/ui/button";
import { sectionGap, sectionLabel } from "@/lib/layout";
import { cn } from "@/lib/utils";

function groupByTopic(items: MasteryItem[]): Map<string, MasteryItem[]> {
  const map = new Map<string, MasteryItem[]>();
  for (const item of items) {
    const list = map.get(item.topic) ?? [];
    list.push(item);
    map.set(item.topic, list);
  }
  return map;
}

export function MasteryPage() {
  const [params, setParams] = useSearchParams();
  const selectedTopic = params.get("topic");

  const [summaries, setSummaries] = useState<TopicSummary[]>([]);
  const [dueCount, setDueCount] = useState(0);
  const [items, setItems] = useState<MasteryItem[]>([]);
  const [graph, setGraph] = useState<TopicGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showScores, setShowScores] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetchProgressSummary(),
      fetchDue(),
      fetchMastery(selectedTopic ?? undefined),
      selectedTopic ? fetchTopicGraph(selectedTopic) : Promise.resolve(null),
    ])
      .then(([sum, due, mastery, g]) => {
        setSummaries(sum.topics);
        setDueCount(due.items.length);
        setItems(mastery.items.filter((i) => i.kind === "concept"));
        setGraph(g);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
  }, [selectedTopic]);

  const rollup = useMemo(() => {
    const totalConcepts = summaries.reduce((n, s) => n + s.concept_count, 0);
    const mastered = summaries.reduce((n, s) => n + s.mastered_count, 0);
    return { totalConcepts, mastered, topics: summaries.length };
  }, [summaries]);

  const byTopic = useMemo(() => groupByTopic(items), [items]);
  const selectedSummary = summaries.find((s) => s.topic_id === selectedTopic);

  return (
    <AppShell
      breadcrumb={
        selectedTopic && selectedSummary
          ? [
              { label: "Progress", to: "/mastery" },
              { label: selectedSummary.display_name },
            ]
          : undefined
      }
    >
      <PageScaffold tier="wide">
        {loading && <p className="text-sm text-on-muted">Loading…</p>}
        {error && (
          <p className="rounded-xl border border-score-low/30 px-4 py-3 text-sm text-score-low">
            {error}
          </p>
        )}

        {!loading && !selectedTopic && (
          <div className={cn("flex flex-col", sectionGap)}>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Topics" value={String(rollup.topics)} />
              <StatCard
                label="Mastery"
                value={
                  rollup.totalConcepts > 0
                    ? `${Math.round((rollup.mastered / rollup.totalConcepts) * 100)}%`
                    : "—"
                }
                hint={`${rollup.mastered} of ${rollup.totalConcepts} concepts`}
              />
              <StatCard
                label="Due for review"
                value={String(dueCount)}
                hint={dueCount > 0 ? "See review queue" : "All caught up"}
                href={dueCount > 0 ? "/due" : undefined}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {summaries.map((t) => (
                <Link
                  key={t.topic_id}
                  to={`/mastery?topic=${encodeURIComponent(t.topic_id)}`}
                  className="rounded-xl border border-line/40 bg-surface/20 px-4 py-3.5 transition-all duration-200 hover:border-accent/20 hover:bg-accent-dim/10 hover:shadow-[0_4px_16px_rgb(0_0_0/0.25)]"
                >
                  <p className="font-display font-semibold text-on-surface">
                    {t.display_name}
                  </p>
                  <p className="mt-1 text-xs text-on-muted">
                    {t.mastered_count}/{t.concept_count} mastered ·{" "}
                    {t.avg_score_1_to_5.toFixed(1)}/5 avg
                    {t.due_count > 0 ? ` · ${t.due_count} due` : ""}
                  </p>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-line/80">
                    <div
                      className="h-full rounded-full bg-accent/70"
                      style={{
                        width: `${
                          t.concept_count > 0
                            ? (t.mastered_count / t.concept_count) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </Link>
              ))}
            </div>

            {summaries.length === 0 && !error && (
              <p className="py-page text-center text-sm text-on-muted">
                No progress yet.{" "}
                <Link to="/topics" className="text-accent hover:underline">
                  Start a topic
                </Link>
              </p>
            )}
          </div>
        )}

        {selectedTopic && (
          <div className={cn("flex flex-col", sectionGap)}>
            <Button variant="outline" size="sm" className="w-fit" onClick={() => setParams({})}>
              ← Overview
            </Button>

            {graph && graph.nodes.length > 0 && (
              <section>
                <h2 className={sectionLabel}>Concept map</h2>
                <ConceptGraph graph={graph} />
              </section>
            )}

            <section>
              <button
                type="button"
                onClick={() => setShowScores((v) => !v)}
                className="flex w-full items-center justify-between rounded-xl border border-line/40 bg-surface/20 px-4 py-3 text-left text-sm font-medium text-on-surface"
              >
                Concept scores
                <ChevronDown
                  className={cn(
                    "size-4 text-on-muted transition-transform",
                    showScores && "rotate-180",
                  )}
                />
              </button>
              {showScores && (
                <ul className="mt-2 divide-y divide-line/40 rounded-xl border border-line/40 bg-surface/15">
                  {[...byTopic.entries()].flatMap(([, concepts]) =>
                    concepts.map((c) => (
                      <li
                        key={c.concept_id}
                        className="flex items-center justify-between gap-4 px-4 py-2.5"
                      >
                        <span className="text-sm text-on-muted">{c.name}</span>
                        <MasteryTicks score={Math.round(c.score_1_to_5)} />
                      </li>
                    )),
                  )}
                </ul>
              )}
            </section>
          </div>
        )}
      </PageScaffold>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
}) {
  const inner = (
    <>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-on-muted">
        {label}
      </p>
      <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-on-surface">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-on-muted">{hint}</p>}
    </>
  );

  if (href) {
    return (
      <Link
        to={href}
        className="rounded-xl border border-line/40 bg-surface/25 px-4 py-3.5 transition-colors hover:border-accent/30"
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="rounded-xl border border-line/40 bg-surface/25 px-4 py-3.5">
      {inner}
    </div>
  );
}
