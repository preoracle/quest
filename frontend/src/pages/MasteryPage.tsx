import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  fetchMastery,
  fetchProgressSummary,
  fetchTopicGraph,
} from "@/api/client";
import type { MasteryItem, TopicGraph, TopicSummary } from "@/api/types";
import { AppShell } from "@/components/AppShell";
import { ConceptGraph } from "@/components/ConceptGraph";
import { PageHeader } from "@/components/PageHeader";
import { MasteryOverviewChart } from "@/components/MasteryOverviewChart";
import { TopicSummaryCard } from "@/components/TopicSummaryCard";
import { MasteryTicks } from "@/components/MasteryTicks";
import { Button } from "@/components/ui/button";

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
  const [items, setItems] = useState<MasteryItem[]>([]);
  const [graph, setGraph] = useState<TopicGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetchProgressSummary(),
      fetchMastery(selectedTopic ?? undefined),
      selectedTopic ? fetchTopicGraph(selectedTopic) : Promise.resolve(null),
    ])
      .then(([sum, mastery, g]) => {
        setSummaries(sum.topics);
        setItems(mastery.items.filter((i) => i.kind === "concept"));
        setGraph(g);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
  }, [selectedTopic]);

  const byTopic = useMemo(() => groupByTopic(items), [items]);
  const selectedSummary = summaries.find((s) => s.topic_id === selectedTopic);

  return (
    <AppShell>
      <div className="px-5 py-8 lg:px-8">
        <PageHeader
          title="Progress"
          description="Mastery across your concept maps — overview, graph, then detail."
        />

        {loading && <p className="text-sm text-on-muted">Loading…</p>}
        {error && (
          <p className="rounded-lg border border-score-low/30 p-4 text-sm text-score-low">
            {error}
          </p>
        )}

        {!loading && !selectedTopic && (
          <>
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {summaries.map((t) => (
                <TopicSummaryCard key={t.topic_id} topic={t} />
              ))}
            </div>
            <MasteryOverviewChart topics={summaries} />
            {summaries.length === 0 && !error && (
              <p className="py-12 text-center text-on-muted">
                No topics yet.{" "}
                <Link to="/topics" className="text-accent hover:underline">
                  Add one
                </Link>
              </p>
            )}
          </>
        )}

        {selectedTopic && (
          <div className="space-y-8">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setParams({})}
              >
                ← All topics
              </Button>
              {selectedSummary && (
                <span className="font-display text-xl font-semibold">
                  {selectedSummary.display_name}
                </span>
              )}
            </div>

            {graph && graph.nodes.length > 0 && (
              <section>
                <h2 className="mb-3 font-mono text-xs font-semibold uppercase tracking-widest text-on-muted">
                  Concept map
                </h2>
                <ConceptGraph graph={graph} />
              </section>
            )}

            <section>
              <h2 className="mb-3 font-mono text-xs font-semibold uppercase tracking-widest text-on-muted">
                Scores
              </h2>
              {[...byTopic.entries()].map(([topic, concepts]) => (
                <ul key={topic} className="card divide-y divide-line">
                  {concepts.map((c) => (
                    <li
                      key={c.concept_id}
                      className="flex items-center justify-between gap-4 px-5 py-4"
                    >
                      <span className="text-sm font-medium">{c.name}</span>
                      <MasteryTicks score={Math.round(c.score_1_to_5)} />
                    </li>
                  ))}
                </ul>
              ))}
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}
