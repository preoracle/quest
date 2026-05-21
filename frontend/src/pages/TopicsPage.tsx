import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { AlertCircle, Search } from "lucide-react";
import { fetchDue, fetchTopics, startSession } from "@/api/client";
import type { StartMode } from "@/api/types";
import { AppShell } from "@/components/AppShell";
import { CreateTopicSection } from "@/components/CreateTopicSection";
import { PageHeader } from "@/components/PageHeader";
import { TopicListSkeleton } from "@/components/Skeleton";
import { TopicCard } from "@/components/TopicCard";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  filterTopics,
  groupTopics,
  rankTopics,
  recordTopicUse,
  type TopicFilter,
} from "@/lib/topicActivity";

const FILTERS: { id: TopicFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "due", label: "Due" },
  { id: "in_progress", label: "In progress" },
  { id: "new", label: "New" },
];

export function TopicsPage() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const [topics, setTopics] = useState<ReturnType<typeof rankTopics>>([]);
  const [due, setDue] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TopicFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  function reloadCatalog() {
    setLoading(true);
    Promise.all([fetchTopics(), fetchDue()])
      .then(([t, d]) => {
        setTopics(rankTopics(t));
        setDue(d.items.length);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not reach API"),
      )
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reloadCatalog();
  }, []);

  const filtered = useMemo(
    () => filterTopics(topics, filter, query),
    [topics, filter, query],
  );

  const sections = useMemo(() => {
    if (filter !== "all" || query.trim()) {
      return { pickUp: filtered, explore: [] as typeof filtered, library: [] as typeof filtered };
    }
    return groupTopics(filtered);
  }, [filtered, filter, query]);

  async function begin(topicId: string, mode: StartMode) {
    setStarting(topicId);
    setError(null);
    recordTopicUse(topicId);
    try {
      const session = await startSession(topicId, mode);
      navigate(`/session/${session.session_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start session");
    } finally {
      setStarting(null);
    }
  }

  function renderTopic(t: (typeof topics)[0], i: number) {
    return (
      <motion.div
        key={t.id}
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.03 }}
      >
        <TopicCard
          id={t.id}
          displayName={t.display_name}
          hook={t.hook}
          conceptCount={t.concept_count}
          previewConcepts={t.preview_concepts}
          started={t.started}
          masteredCount={t.mastered_count}
          avgScore={t.avg_score_1_to_5}
          dueCount={t.due_count}
          busy={starting === t.id}
          expanded={expandedId === t.id}
          onToggle={() => setExpandedId((cur) => (cur === t.id ? null : t.id))}
          onStart={(mode) => begin(t.id, mode)}
        />
      </motion.div>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-1 flex-col px-5 py-8 lg:px-8">
        <PageHeader
          title="Topics"
          description="Each card previews what you'll study. Continue is the default; expand for other modes."
        />

        <CreateTopicSection onCreated={reloadCatalog} />

        {due > 0 && (
          <Link
            to="/due"
            className="card-hover mb-6 flex items-center justify-between gap-4 border-accent/20 bg-accent-dim p-4"
          >
            <span className="text-sm">
              <span className="font-semibold text-accent">{due}</span>
              <span className="text-on-muted"> concepts due for spaced review</span>
            </span>
            <span className="text-xs font-medium text-accent">Review →</span>
          </Link>
        )}

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-muted" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search topics or concepts…"
              className="pl-10"
              aria-label="Search topics"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  filter === id
                    ? "bg-accent-dim text-accent ring-1 ring-accent/30"
                    : "bg-surface-muted text-on-muted hover:text-on-surface",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-score-low/30 bg-score-low/10 p-4 text-sm text-score-low">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        )}

        {loading ? (
          <TopicListSkeleton />
        ) : (
          <div className="space-y-10">
            {sections.pickUp.length > 0 && (
              <section>
                <SectionHeading
                  title="Pick up"
                  hint="Due for review, recently studied, or in progress"
                />
                <div className="space-y-3">
                  {sections.pickUp.map((t, i) => renderTopic(t, i))}
                </div>
              </section>
            )}

            {sections.explore.length > 0 && (
              <section>
                <SectionHeading title="Explore" hint="Topics you haven't started yet" />
                <div className="space-y-3">
                  {sections.explore.map((t, i) => renderTopic(t, i))}
                </div>
              </section>
            )}

            {sections.library.length > 0 && (
              <section>
                <SectionHeading title="Library" hint="Everything else" />
                <div className="space-y-3">
                  {sections.library.map((t, i) => renderTopic(t, i))}
                </div>
              </section>
            )}

            {filtered.length === 0 && (
              <p className="py-12 text-center text-sm text-on-muted">
                No topics match your search or filter.
              </p>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function SectionHeading({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-accent">
        {title}
      </h2>
      <p className="mt-1 text-xs text-on-muted">{hint}</p>
    </div>
  );
}
