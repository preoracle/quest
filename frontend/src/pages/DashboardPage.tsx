import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle, ArrowRight, BarChart2, BookOpen, CalendarCheck,
  CheckCircle2, Clock, Flame, Layers, TrendingUp, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { fetchDue, fetchTopics, startSession } from "@/api/client";
import { AppShell } from "@/components/AppShell";
import { PageScaffold } from "@/components/PageScaffold";
import { Button } from "@/components/ui/button";
import { sectionGap } from "@/lib/layout";
import { cn, progressBarColor } from "@/lib/utils";
import { rankTopics, recordTopicUse } from "@/lib/topicActivity";
import { getStudyStreak, recordStudyDay } from "@/lib/streak";
import type { TopicCatalogItem } from "@/api/types";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

interface Recommendation {
  topic: TopicCatalogItem;
  label: string;
  subtext: string;
  mode: "resume" | "replay";
}

function getRecommendation(
  inProgress: TopicCatalogItem[],
  dueByTopic: [string, number][],
  weakTopics: TopicCatalogItem[],
): Recommendation | null {
  // 1. Weak topic that's also overdue — most urgent
  const urgentWeak = weakTopics.find((t) => t.due_count > 0);
  if (urgentWeak) {
    return {
      topic: urgentWeak,
      label: "Review now — scores are slipping",
      subtext: `avg ${urgentWeak.avg_score_1_to_5.toFixed(1)}/5 · ${urgentWeak.due_count} concept${urgentWeak.due_count !== 1 ? "s" : ""} overdue`,
      mode: "resume",
    };
  }
  // 2. Topic with most due concepts
  if (dueByTopic.length > 0) {
    const [topicId, count] = dueByTopic[0];
    const topic = inProgress.find((t) => t.id === topicId);
    if (topic) {
      return {
        topic,
        label: "Time for review",
        subtext: `${count} concept${count !== 1 ? "s" : ""} due for review`,
        mode: "resume",
      };
    }
  }
  // 3. Weakest in-progress topic
  if (weakTopics.length > 0) {
    const t = weakTopics[0];
    return {
      topic: t,
      label: "Needs work",
      subtext: `avg score ${t.avg_score_1_to_5.toFixed(1)}/5 — push this higher`,
      mode: "resume",
    };
  }
  // 4. Most recently active topic
  if (inProgress.length > 0) {
    const t = inProgress[0];
    return {
      topic: t,
      label: "Continue where you left off",
      subtext: `${t.mastered_count}/${t.concept_count} concepts mastered`,
      mode: "resume",
    };
  }
  return null;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const [starting, setStarting] = useState<string | null>(null);
  const streak = getStudyStreak();

  const { data: dueData } = useQuery({
    queryKey: ["due"],
    queryFn: () => fetchDue(),
    staleTime: 60_000,
  });

  const { data: topicsData } = useQuery({
    queryKey: ["topics", "", false],
    queryFn: () => fetchTopics({ q: "", includeArchived: false }),
    staleTime: 30_000,
  });

  const dueItems = dueData?.items ?? [];
  const dueCount = dueItems.length;

  const ranked = rankTopics(topicsData ?? []);
  const inProgress = ranked.filter((t) => t.started);
  const continueTopics = inProgress.slice(0, 5);

  const totalConcepts = ranked.reduce((n, t) => n + t.concept_count, 0);
  const totalMastered = ranked.reduce((n, t) => n + t.mastered_count, 0);
  const masteryPct = totalConcepts > 0 ? Math.round((totalMastered / totalConcepts) * 100) : 0;

  const weakTopics = inProgress
    .filter((t) => t.avg_score_1_to_5 > 0 && t.avg_score_1_to_5 < 3.2)
    .sort((a, b) => a.avg_score_1_to_5 - b.avg_score_1_to_5);

  const dueByTopic = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of dueItems) {
      map.set(item.topic, (map.get(item.topic) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [dueItems]);

  const recommendation = useMemo(
    () => getRecommendation(inProgress, dueByTopic, weakTopics),
    [inProgress, dueByTopic, weakTopics],
  );

  async function begin(topicId: string, mode: "resume" | "replay" = "resume") {
    setStarting(topicId);
    recordTopicUse(topicId);
    recordStudyDay();
    try {
      const session = await startSession(topicId, mode);
      if (session.done) {
        const fresh = await startSession(topicId, "replay");
        navigate(`/session/${fresh.session_id}`);
      } else {
        navigate(`/session/${session.session_id}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start session");
    } finally {
      setStarting(null);
    }
  }

  const hasData = topicsData !== undefined;
  const hasActivity = inProgress.length > 0;

  return (
    <AppShell>
      <PageScaffold tier="wide">
        <div className={cn("flex flex-col", sectionGap)}>

          {/* Greeting + streak */}
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap items-start justify-between gap-3"
          >
            <div>
              <h1 className="font-display text-2xl font-semibold text-on-surface">
                {greeting()}
              </h1>
              <p className="mt-0.5 text-sm text-on-muted">
                {dueCount > 0
                  ? `${dueCount} concept${dueCount !== 1 ? "s" : ""} due for review.`
                  : hasActivity
                  ? "You're all caught up. Keep the momentum."
                  : "Pick a topic and start building real understanding."}
              </p>
            </div>
            {streak > 0 && (
              <div className="flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent-dim/30 px-3 py-1.5">
                <Flame className="size-3.5 text-accent" />
                <span className="font-mono text-xs font-semibold text-accent">
                  {streak}-day streak
                </span>
              </div>
            )}
          </motion.div>

          {/* Two-column layout: main | sidebar */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">

            {/* ── LEFT COLUMN ── */}
            <div className="flex flex-col gap-5">

              {/* Primary recommendation */}
              {hasData && recommendation && (
                <motion.div
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="relative overflow-hidden rounded-xl border border-accent/30 bg-gradient-to-br from-accent-dim/40 via-surface/20 to-transparent p-5"
                >
                  <div className="pointer-events-none absolute -top-12 -right-8 size-40 rounded-full bg-accent/6 blur-3xl" />
                  <p className="section-label mb-0">{recommendation.label}</p>
                  <h2 className="mt-2 font-display text-xl font-semibold text-on-surface">
                    {recommendation.topic.display_name}
                  </h2>
                  <p className="mt-1 text-sm text-on-muted">{recommendation.subtext}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={!!starting}
                      onClick={() => void begin(recommendation.topic.id, recommendation.mode)}
                    >
                      {starting === recommendation.topic.id ? "Starting…" : "Start session"}
                      <ArrowRight className="size-3.5" />
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                      <Link to={`/topics/${recommendation.topic.id}`} className="text-on-muted">
                        View topic
                      </Link>
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Empty state */}
              {hasData && !hasActivity && (
                <motion.div
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center gap-5 rounded-xl border border-line/40 bg-surface/20 px-6 py-14 text-center"
                >
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-accent/10">
                    <BookOpen className="size-6 text-accent" />
                  </div>
                  <div>
                    <p className="font-display font-semibold text-on-surface">
                      Nothing in progress yet
                    </p>
                    <p className="mt-1.5 max-w-xs text-sm text-on-muted">
                      Pick a topic and Quest will track every concept — then resurface them just before you'd forget.
                    </p>
                  </div>
                  <Button asChild>
                    <Link to="/topics">Browse topics <ArrowRight className="size-4" /></Link>
                  </Button>
                </motion.div>
              )}

              {/* Continue studying */}
              {continueTopics.length > 0 && (
                <motion.section
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <h2 className="section-label mb-2">All topics</h2>
                  <div className="flex flex-col gap-1.5">
                    {continueTopics.map((topic, i) => {
                      const pct = topic.concept_count
                        ? Math.round((topic.mastered_count / topic.concept_count) * 100)
                        : 0;
                      const isRec = recommendation?.topic.id === topic.id;
                      return (
                        <motion.div
                          key={topic.id}
                          initial={reduce ? false : { opacity: 0, x: -4 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.12 + i * 0.03 }}
                          className={cn(
                            "flex items-center gap-3 rounded-xl border px-4 py-2.5 transition-colors",
                            isRec
                              ? "border-accent/20 bg-accent-dim/10"
                              : "border-line/40 bg-surface/25 hover:border-line/60 hover:bg-surface/35",
                          )}
                        >
                          <Link to={`/topics/${topic.id}`} className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-medium text-on-surface">
                                {topic.display_name}
                              </p>
                              {topic.due_count > 0 && (
                                <span className="shrink-0 rounded-full bg-accent-dim px-1.5 py-0.5 font-mono text-[10px] font-semibold text-accent">
                                  {topic.due_count} due
                                </span>
                              )}
                              {topic.avg_score_1_to_5 > 0 && topic.avg_score_1_to_5 < 3.2 && (
                                <span className="shrink-0 rounded-full border border-score-low/30 bg-score-low/8 px-1.5 py-0.5 font-mono text-[10px] text-score-low">
                                  {topic.avg_score_1_to_5.toFixed(1)}
                                </span>
                              )}
                            </div>
                            <div className="mt-1 flex items-center gap-2">
                              <div className="h-1 w-20 overflow-hidden rounded-full bg-line/50">
                                <div
                                  className={cn("h-full rounded-full", progressBarColor(topic.avg_score_1_to_5))}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="font-mono text-[11px] text-on-muted/60">
                                {topic.mastered_count}/{topic.concept_count}
                              </span>
                            </div>
                          </Link>
                          <Button
                            size="sm"
                            variant={isRec ? "default" : "outline"}
                            disabled={starting === topic.id}
                            onClick={() => void begin(topic.id)}
                            className="shrink-0"
                          >
                            {starting === topic.id ? "…" : isRec ? "Continue" : "Study"}
                          </Button>
                        </motion.div>
                      );
                    })}
                    {inProgress.length > continueTopics.length && (
                      <Link
                        to="/topics"
                        className="mt-0.5 text-center text-xs text-on-muted/60 hover:text-accent"
                      >
                        +{inProgress.length - continueTopics.length} more topics →
                      </Link>
                    )}
                  </div>
                </motion.section>
              )}
            </div>

            {/* ── RIGHT COLUMN ── */}
            <div className="flex flex-col gap-4">

              {/* Stats */}
              {hasData && (
                <motion.div
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.06 }}
                  className="rounded-xl border border-line/40 bg-surface/20 p-4"
                >
                  <h2 className="section-label mb-3">Your progress</h2>
                  <div className="flex flex-col gap-3">
                    {[
                      {
                        icon: Layers,
                        label: "Active topics",
                        value: String(inProgress.length),
                        sub: `of ${ranked.length} available`,
                        color: "text-accent",
                      },
                      {
                        icon: TrendingUp,
                        label: "Overall mastery",
                        value: totalConcepts > 0 ? `${masteryPct}%` : "—",
                        sub: `${totalMastered} of ${totalConcepts} concepts`,
                        color: totalMastered > 0 ? "text-score-good" : "text-on-muted",
                      },
                      {
                        icon: dueCount > 0 ? Clock : CheckCircle2,
                        label: "Due for review",
                        value: String(dueCount),
                        sub: dueCount > 0 ? "needs attention" : "all caught up",
                        color: dueCount > 0 ? "text-score-low" : "text-score-good",
                      },
                    ].map(({ icon: Icon, label, value, sub, color }) => (
                      <div key={label} className="flex items-center gap-3">
                        <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted/60", color)}>
                          <Icon className="size-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-on-muted">{label}</p>
                          <div className="flex items-baseline gap-1.5">
                            <span className={cn("font-mono text-base font-semibold tabular-nums", color)}>
                              {value}
                            </span>
                            <span className="text-[11px] text-on-muted/60">{sub}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Link
                    to="/mastery"
                    className="mt-4 flex items-center gap-1 text-xs text-on-muted/60 hover:text-accent"
                  >
                    <BarChart2 className="size-3" />
                    Full progress breakdown
                  </Link>
                </motion.div>
              )}

              {/* Due breakdown */}
              {dueCount > 0 && (
                <motion.div
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="rounded-xl border border-score-low/20 bg-score-low/5 p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h2 className="section-label mb-0 text-score-low/80">Due now</h2>
                    <Link to="/due" className="text-[11px] text-score-low/70 hover:text-score-low">
                      See all →
                    </Link>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {dueByTopic.slice(0, 4).map(([topicId, count]) => (
                      <div key={topicId} className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-medium text-on-surface capitalize">
                          {topicId.replace(/_/g, " ")}
                        </span>
                        <span className="shrink-0 font-mono text-[11px] text-score-low">
                          {count} due
                        </span>
                      </div>
                    ))}
                  </div>
                  {dueByTopic.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3 w-full border-score-low/30 text-score-low hover:border-score-low/50 hover:bg-score-low/5 hover:text-score-low"
                      asChild
                    >
                      <Link to="/due">
                        <CalendarCheck className="size-3.5" />
                        Review queue
                      </Link>
                    </Button>
                  )}
                </motion.div>
              )}

              {/* Needs attention */}
              {weakTopics.length > 0 && (
                <motion.div
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.14 }}
                  className="rounded-xl border border-line/40 bg-surface/15 p-4"
                >
                  <h2 className="section-label mb-3">
                    <AlertCircle className="size-3 text-score-low/80" />
                    Needs attention
                  </h2>
                  <div className="flex flex-col gap-2">
                    {weakTopics.slice(0, 3).map((topic) => {
                      const pct = topic.concept_count
                        ? Math.round((topic.mastered_count / topic.concept_count) * 100)
                        : 0;
                      return (
                        <div key={topic.id} className="flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-on-surface">
                              {topic.display_name}
                            </p>
                            <div className="mt-1 flex items-center gap-1.5">
                              <div className="h-1 w-14 overflow-hidden rounded-full bg-line/50">
                                <div
                                  className={cn("h-full rounded-full", progressBarColor(topic.avg_score_1_to_5))}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="font-mono text-[10px] text-score-low">
                                {topic.avg_score_1_to_5.toFixed(1)}/5
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={!!starting}
                            onClick={() => void begin(topic.id)}
                            className="shrink-0 text-[11px] font-medium text-accent hover:text-accent-glow disabled:opacity-50"
                          >
                            {starting === topic.id ? "…" : "Study"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* Quick links */}
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16 }}
                className="flex flex-col gap-1"
              >
                {[
                  { to: "/topics", icon: BookOpen, label: "Browse all topics" },
                  { to: "/due", icon: Zap, label: "Full review queue" },
                  { to: "/mastery", icon: BarChart2, label: "Progress breakdown" },
                ].map(({ to, icon: Icon, label }) => (
                  <Link
                    key={to}
                    to={to}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-on-muted/70 transition-colors hover:bg-surface-muted/40 hover:text-on-surface"
                  >
                    <Icon className="size-3.5 shrink-0" />
                    {label}
                  </Link>
                ))}
              </motion.div>

            </div>
          </div>
        </div>
      </PageScaffold>
    </AppShell>
  );
}
