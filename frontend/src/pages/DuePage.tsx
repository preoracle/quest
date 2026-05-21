import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, CalendarCheck } from "lucide-react";
import { fetchDue, startSession } from "@/api/client";
import type { DueItem } from "@/api/types";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ScoreBadge } from "@/components/ScoreBadge";
import { Button } from "@/components/ui/button";

export function DuePage() {
  const reduce = useReducedMotion();
  const [items, setItems] = useState<DueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    fetchDue()
      .then((r) => setItems(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
  }, []);

  async function studyTopic(topicId: string) {
    setStarting(topicId);
    try {
      const session = await startSession(topicId, "study");
      window.location.href = `/session/${session.session_id}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start");
    } finally {
      setStarting(null);
    }
  }

  const byTopic = items.reduce<Map<string, DueItem[]>>((map, item) => {
    const list = map.get(item.topic) ?? [];
    list.push(item);
    map.set(item.topic, list);
    return map;
  }, new Map());

  return (
    <AppShell>
      <div className="px-5 py-8 lg:px-8">
        <PageHeader
          title="Review"
          description="Spaced repetition — concepts you’re about to forget. Quest’s scheduler prioritizes these during study."
        />

        {loading && <p className="text-sm text-on-muted">Loading…</p>}
        {error && (
          <p className="rounded-lg border border-score-low/30 bg-score-low/10 p-4 text-sm text-score-low">
            {error}
          </p>
        )}

        {!loading && items.length === 0 && !error && (
          <div className="card flex flex-col items-center py-16 text-center">
            <CalendarCheck className="mb-4 size-10 text-accent/60" />
            <p className="font-display text-lg font-semibold">All caught up</p>
            <p className="mt-2 text-sm text-on-muted">Nothing due right now.</p>
            <Button asChild className="mt-6" variant="outline">
              <Link to="/topics">Browse topics</Link>
            </Button>
          </div>
        )}

        {items.length > 0 && (
          <div className="card mb-6 flex gap-3 border-accent/25 bg-accent-dim/40 p-4">
            <AlertTriangle className="size-5 shrink-0 text-accent" />
            <p className="text-sm text-on-muted">
              <strong className="text-on-surface">{items.length} concepts</strong>{" "}
              need review. Study the topic — the tutor will focus on weak areas.
            </p>
          </div>
        )}

        <div className="space-y-8">
          {[...byTopic.entries()].map(([topic, concepts], ti) => (
            <motion.section
              key={topic}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: ti * 0.05 }}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-accent">
                  {topic.replace(/_/g, " ")}
                </h2>
                <Button
                  size="sm"
                  disabled={!!starting}
                  onClick={() => studyTopic(topic)}
                >
                  Study topic
                </Button>
              </div>
              <ul className="card divide-y divide-line">
                {concepts.map((item) => (
                  <li
                    key={item.concept_id}
                    className="flex items-center justify-between gap-4 px-4 py-3.5"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-on-surface">{item.name}</p>
                      {item.overdue && (
                        <p className="text-xs text-score-low">Overdue</p>
                      )}
                    </div>
                    <ScoreBadge score={Math.round(item.score_1_to_5)} />
                  </li>
                ))}
              </ul>
            </motion.section>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
