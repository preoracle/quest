import { useEffect, useMemo, useState } from "react";
import { fetchMastery } from "../api/client";
import type { MasteryItem } from "../api/types";
import { Layout } from "../components/Layout";
import { MasteryBar } from "../components/MasteryBar";

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
  const [items, setItems] = useState<MasteryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMastery()
      .then((r) => setItems(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const byTopic = useMemo(() => groupByTopic(items), [items]);

  return (
    <Layout>
      <section className="mx-auto max-w-[1140px] px-6 py-16 md:px-16">
        <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
          Mastery Ledger
        </h1>
        <p className="mt-6 max-w-reading text-lg leading-relaxed text-on-surface-variant">
          Concepts you have examined, scored by the evaluator—not by recall alone.
        </p>

        {loading && (
          <p className="mt-12 font-mono text-sm uppercase tracking-widest text-on-surface-variant">
            Loading…
          </p>
        )}

        {error && (
          <p className="mt-8 border border-outline-variant px-4 py-3 font-mono text-sm">
            {error}
          </p>
        )}

        {!loading && items.length === 0 && !error && (
          <p className="mt-12 text-on-surface-variant">
            No mastery recorded yet. Start an inquiry from the catalog.
          </p>
        )}

        <div className="mt-16 space-y-16">
          {[...byTopic.entries()].map(([topic, concepts]) => (
            <section key={topic}>
              <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-secondary">
                {topic}
              </h2>
              <ul className="mt-6 divide-y divide-outline-variant border border-outline-variant">
                {concepts.map((c) => (
                  <li
                    key={`${c.topic}-${c.concept_id}`}
                    className="flex flex-col gap-4 bg-surface-container-low px-6 py-6 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-display text-xl font-semibold">{c.name}</p>
                      <p className="mt-1 font-mono text-xs uppercase tracking-widest text-on-surface-variant">
                        {c.kind} · {c.concept_id} · {c.num_evaluations} evaluations
                      </p>
                    </div>
                    <MasteryBar score={c.score_1_to_5} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>
    </Layout>
  );
}
