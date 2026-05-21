import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarCheck, Clock } from "lucide-react";
import { toast } from "sonner";
import { fetchDue, startSession } from "@/api/client";
import type { DueItem } from "@/api/types";
import { AppShell } from "@/components/AppShell";
import { PageScaffold } from "@/components/PageScaffold";
import { ScoreBadge } from "@/components/ScoreBadge";
import { Button } from "@/components/ui/button";
import { sectionGap } from "@/lib/layout";
import { cn } from "@/lib/utils";

function daysOverdue(nextReviewAt: string | null): number {
  if (!nextReviewAt) return 0;
  const due = new Date(nextReviewAt);
  const now = new Date();
  return Math.max(0, Math.floor((now.getTime() - due.getTime()) / 86_400_000));
}

function urgencyLabel(days: number): { label: string; className: string } {
  if (days >= 7) return { label: `${days}d overdue`, className: "text-score-low" };
  if (days >= 1) return { label: `${days}d overdue`, className: "text-accent" };
  return { label: "Due today", className: "text-on-muted" };
}

interface TopicGroup {
  topicId: string;
  concepts: DueItem[];
  overdueCount: number;
  maxDaysOverdue: number;
}

function buildGroups(items: DueItem[]): TopicGroup[] {
  const map = new Map<string, DueItem[]>();
  for (const item of items) {
    const list = map.get(item.topic) ?? [];
    list.push(item);
    map.set(item.topic, list);
  }
  return [...map.entries()]
    .map(([topicId, concepts]) => {
      const overdueCount = concepts.filter((c) => c.overdue).length;
      const maxDaysOverdue = Math.max(
        ...concepts.map((c) => daysOverdue(c.next_review_at)),
      );
      return { topicId, concepts, overdueCount, maxDaysOverdue };
    })
    .sort((a, b) => b.maxDaysOverdue - a.maxDaysOverdue || b.overdueCount - a.overdueCount);
}

export function DuePage() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const [starting, setStarting] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["due"],
    queryFn: () => fetchDue(),
    staleTime: 60_000,
  });

  const items = data?.items ?? [];
  const groups = buildGroups(items);
  const mostUrgentTopic = groups[0]?.topicId;

  async function studyTopic(topicId: string) {
    setStarting(topicId);
    try {
      let session = await startSession(topicId, "study");
      if (session.done) {
        session = await startSession(topicId, "resume");
      }
      if (session.done) {
        session = await startSession(topicId, "replay");
      }
      navigate(`/session/${session.session_id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start");
    } finally {
      setStarting(null);
    }
  }

  const toolbar =
    !isLoading && items.length > 0 ? (
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-on-muted">
          <span className="font-semibold text-on-surface">{items.length}</span>{" "}
          concept{items.length !== 1 ? "s" : ""} queued for spaced review
        </p>
        {mostUrgentTopic && (
          <Button
            size="sm"
            disabled={!!starting}
            onClick={() => void studyTopic(mostUrgentTopic)}
          >
            {starting === mostUrgentTopic ? "Starting…" : "Start most urgent"}
          </Button>
        )}
      </div>
    ) : undefined;

  return (
    <AppShell>
      <PageScaffold toolbar={toolbar} tier="catalog">
        {isLoading && <p className="text-sm text-on-muted">Loading…</p>}
        {error && (
          <p className="rounded-xl border border-score-low/30 bg-score-low/10 px-4 py-3 text-sm text-score-low">
            {error instanceof Error ? error.message : "Failed to load"}
          </p>
        )}

        {!isLoading && items.length === 0 && !error && (
          <div className="flex flex-col items-center py-page text-center">
            <CalendarCheck className="mb-4 size-10 text-accent/50" />
            <h1 className="font-display text-lg font-semibold">All caught up</h1>
            <p className="mt-2 max-w-sm text-sm text-on-muted">
              Nothing is due for review. Check back after your next study sessions.
            </p>
            <Button asChild className="mt-8" variant="outline">
              <Link to="/topics">Browse topics</Link>
            </Button>
          </div>
        )}

        <div className={cn("flex flex-col", sectionGap)}>
          {groups.map((group, ti) => (
            <motion.section
              key={group.topicId}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: ti * 0.04 }}
            >
              <div className="mb-2 flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-2">
                  <h2 className="truncate font-display text-base font-semibold capitalize text-on-surface">
                    {group.topicId.replace(/_/g, " ")}
                  </h2>
                  <span className="shrink-0 font-mono text-xs text-on-muted">
                    {group.concepts.length} concept{group.concepts.length !== 1 ? "s" : ""}
                  </span>
                  {group.overdueCount > 0 && (
                    <span className="flex shrink-0 items-center gap-1 text-xs text-score-low">
                      <AlertTriangle className="size-3" />
                      {group.overdueCount} overdue
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  disabled={!!starting}
                  onClick={() => void studyTopic(group.topicId)}
                >
                  {starting === group.topicId ? "Starting…" : "Study"}
                </Button>
              </div>
              <ul className="divide-y divide-line/50 rounded-xl border border-line/40 bg-surface/20">
                {group.concepts.map((item) => {
                  const days = daysOverdue(item.next_review_at);
                  const urgency = urgencyLabel(days);
                  return (
                    <li
                      key={item.concept_id}
                      className="flex items-center justify-between gap-4 px-4 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-on-surface">
                          {item.name}
                        </p>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <Clock className="size-3 text-on-muted/60" />
                          <span className={cn("text-xs", urgency.className)}>
                            {urgency.label}
                          </span>
                        </div>
                      </div>
                      <ScoreBadge score={Math.round(item.score_1_to_5)} />
                    </li>
                  );
                })}
              </ul>
            </motion.section>
          ))}
        </div>
      </PageScaffold>
    </AppShell>
  );
}
