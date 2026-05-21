import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { fetchTopicGraph } from "@/api/client";
import type { GraphNode, SessionView, TopicGraph } from "@/api/types";
import type { TranscriptEntry } from "@/lib/transcript";

// ─── Data hook ───────────────────────────────────────────────────────────────

function useTopicGraph(topicId: string | null | undefined) {
  const [graph, setGraph] = useState<TopicGraph | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!topicId) return;
    setLoading(true);
    fetchTopicGraph(topicId)
      .then(setGraph)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [topicId]);

  return { graph, loading };
}

// ─── Sidebar skeleton ─────────────────────────────────────────────────────────

function SidebarSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-2.5 w-16 rounded bg-surface-muted" />
      <div className="h-5 w-3/4 rounded bg-surface-muted" />
      <div className="space-y-2 mt-1">
        <div className="h-3 w-full rounded bg-surface-muted" />
        <div className="h-3 w-5/6 rounded bg-surface-muted" />
        <div className="h-3 w-4/6 rounded bg-surface-muted" />
      </div>
    </div>
  );
}

// ─── Now studying ─────────────────────────────────────────────────────────────

function ConceptSection({
  node,
  topicDisplay,
}: {
  node: GraphNode | null;
  topicDisplay: string | null | undefined;
}) {
  const name = node?.name ?? topicDisplay ?? "—";
  const animKey = node?.id ?? name;

  return (
    <div>
      <p className="section-label">Now studying</p>
      <AnimatePresence mode="wait">
        <motion.div
          key={animKey}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25 }}
          className="space-y-2"
        >
          <p className="text-[15px] font-semibold leading-snug text-on-surface">
            {name}
          </p>
          {node?.description && (
            <p className="text-[13px] leading-[1.65] text-on-muted/65 line-clamp-4">
              {node.description}
            </p>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─── Prerequisite chips ───────────────────────────────────────────────────────

function PrerequisiteSection({ prereqNodes }: { prereqNodes: GraphNode[] }) {
  if (prereqNodes.length === 0) return null;

  return (
    <div>
      <div className="mb-5 h-px bg-line/15" />
      <p className="section-label">Builds on</p>
      <div className="flex flex-wrap gap-1.5">
        {prereqNodes.map((n) => {
          const s = Math.round(n.score_1_to_5);
          return (
            <span
              key={n.id}
              className="inline-flex items-center gap-1.5 rounded-md border border-line/30 bg-surface-muted/40 px-2.5 py-1 text-[12px] text-on-muted/65"
            >
              {s > 0 && (
                <span
                  className="size-1.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      s >= 4
                        ? "var(--color-score-good)"
                        : s >= 3
                          ? "var(--color-accent)"
                          : "var(--color-score-low)",
                    opacity: 0.65,
                  }}
                />
              )}
              {n.name}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ─── Session gaps ─────────────────────────────────────────────────────────────

const GAP_VISIBLE = 4;

function GapsSection({ gaps }: { gaps: string[] }) {
  const [expanded, setExpanded] = useState(false);
  if (gaps.length === 0) return null;

  const visible = expanded ? gaps : gaps.slice(0, GAP_VISIBLE);
  const overflow = gaps.length - GAP_VISIBLE;

  return (
    <div>
      <div className="mb-5 h-px bg-line/15" />
      <p className="section-label">Gaps so far</p>
      <AnimatePresence initial={false}>
        <ul className="space-y-2.5">
          {visible.map((gap) => (
            <motion.li
              key={gap}
              layout
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-start gap-2.5 text-[13px] leading-[1.6] text-on-muted/65"
            >
              <span
                className="mt-[6px] size-1 shrink-0 rounded-full"
                style={{ backgroundColor: "var(--color-score-low)", opacity: 0.5 }}
              />
              {gap}
            </motion.li>
          ))}
        </ul>
      </AnimatePresence>

      {!expanded && overflow > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 text-[12px] text-on-muted/35 transition-colors hover:text-on-muted/65"
        >
          +{overflow} more
        </button>
      )}
    </div>
  );
}

// ─── Export ──────────────────────────────────────────────────────────────────

export function SessionSidebar({
  session,
  transcript,
}: {
  session: SessionView | null;
  transcript: TranscriptEntry[];
}) {
  const { graph, loading } = useTopicGraph(session?.topic_id);

  const activeNode = useMemo<GraphNode | null>(() => {
    if (!graph) return null;
    const focus = session?.focus?.trim().toLowerCase();
    if (focus) {
      const byName = graph.nodes.find(
        (n) => n.name.trim().toLowerCase() === focus,
      );
      if (byName) return byName;
    }
    const inferredId = session?.last_evaluation?.inferred_concept_id;
    if (inferredId) {
      return graph.nodes.find((n) => n.id === inferredId) ?? null;
    }
    return null;
  }, [graph, session?.focus, session?.last_evaluation?.inferred_concept_id]);

  const prereqNodes = useMemo<GraphNode[]>(() => {
    if (!graph || !activeNode) return [];
    return activeNode.prerequisites
      .map((id) => graph.nodes.find((n) => n.id === id))
      .filter((n): n is GraphNode => !!n);
  }, [graph, activeNode]);

  const gaps = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const entry of transcript) {
      if (entry.kind === "eval") {
        for (const gap of entry.gaps) {
          const key = gap.trim();
          if (key && !seen.has(key)) {
            seen.add(key);
            result.push(key);
          }
        }
      }
    }
    return result;
  }, [transcript]);

  const hasAnyEval = transcript.some((e) => e.kind === "eval");

  return (
    <aside className="hidden xl:flex w-80 shrink-0 flex-col overflow-y-auto border-l border-line/15 px-6 py-7 sidebar-bg backdrop-blur-2xl">
      {loading && !graph ? (
        <SidebarSkeleton />
      ) : (
        <div className="flex flex-col gap-0">
          <ConceptSection
            node={activeNode}
            topicDisplay={session?.topic_display}
          />
          <PrerequisiteSection prereqNodes={prereqNodes} />
          {hasAnyEval && <GapsSection gaps={gaps} />}
        </div>
      )}
    </aside>
  );
}
