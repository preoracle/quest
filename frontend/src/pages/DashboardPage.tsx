import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight, BookOpen, CalendarCheck, Flame, Loader2, Plus, Send,
} from "lucide-react";
import { toast } from "sonner";
import { fetchDue, fetchStreak, fetchTopics, generateTopic, postStudyDay, startSession } from "@/api/client";
import { AppShell } from "@/components/AppShell";
import { DashboardSkeleton } from "@/components/Skeleton";
import { MasteryTicks } from "@/components/MasteryTicks";
import { PageScaffold } from "@/components/PageScaffold";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { rankTopics, recordTopicUse } from "@/lib/topicActivity";
import { getStudyStreak, getStudyDates, recordStudyDay } from "@/lib/streak";
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

function focusSignal(topic: TopicCatalogItem): {
  label: string;
  tone: string;
  nextStep: string;
} {
  const masteryRatio =
    topic.concept_count > 0 ? topic.mastered_count / topic.concept_count : 0;
  const score = topic.avg_score_1_to_5;

  // Deterministic variation so different threads don't sound identical.
  const pick = (variants: string[]) => {
    let h = 0;
    for (let i = 0; i < topic.id.length; i++) {
      h = (h * 31 + topic.id.charCodeAt(i)) >>> 0;
    }
    return variants[h % variants.length]!;
  };

  if (topic.due_count > 0) {
    const n = topic.due_count;
    return {
      label: "Needs reinforcement",
      tone: "text-score-low",
      nextStep: pick([
        `Clear the queue: do 1 due concept now${n > 1 ? ` (of ${n})` : ""}.`,
        `Re-anchor the weakest edge: pick the most confusing due concept and explain it in 3 sentences.`,
        `Quick repair: answer one due concept cold, then rewrite the mechanism as a checklist.`,
      ]),
    };
  }
  if (score > 0 && score < 3.2) {
    return {
      label: "Fragile understanding",
      tone: "text-score-mid",
      nextStep: pick([
        "Rebuild the core mechanism in your own words before adding detail.",
        "Do a minimal proof: define terms → state the invariant → walk one example end-to-end.",
        "Make one crisp contrast: what would you do instead, and why is this approach better here?",
      ]),
    };
  }
  if (masteryRatio < 0.18 && topic.concept_count >= 8) {
    return {
      label: "Early thread",
      tone: "text-on-muted",
      nextStep: pick([
        "Do a baseline pass: aim for breadth, not correctness. Capture what you keep forgetting.",
        "Start a clean run and collect 3 “anchor concepts” you can always return to.",
        "Sketch the map: list 5 core concepts and draw arrows for dependencies.",
      ]),
    };
  }
  return {
    label: "Stable momentum",
    tone: "text-score-good",
    nextStep: pick([
      "Push depth: compare this approach against a realistic alternative.",
      "Stress-test: where does this break? Name one edge case and how you'd detect it.",
      "Teach it: explain the idea to a skeptical engineer in under 60 seconds.",
    ]),
  };
}

function getRecommendation(
  inProgress: TopicCatalogItem[],
  dueByTopic: [string, number][],
  weakTopics: TopicCatalogItem[],
): Recommendation | null {
  const urgentWeak = weakTopics.find((t) => t.due_count > 0);
  if (urgentWeak) {
    return {
      topic: urgentWeak,
      label: "Review now — scores are slipping",
      subtext: `avg ${urgentWeak.avg_score_1_to_5.toFixed(1)}/5 · ${urgentWeak.due_count} concept${urgentWeak.due_count !== 1 ? "s" : ""} overdue`,
      mode: "resume",
    };
  }
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
  if (weakTopics.length > 0) {
    const t = weakTopics[0];
    return {
      topic: t,
      label: "Needs more work",
      subtext: `avg score ${t.avg_score_1_to_5.toFixed(1)}/5 — push this higher`,
      mode: "resume",
    };
  }
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

/** Activity heatmap — 12 weeks of study history */
function ActivityHeatmap({ fullWidth = false, studyDates: serverDates }: { fullWidth?: boolean; studyDates?: Set<string> }) {
  const localDates = useMemo(() => getStudyDates(), []);
  const studyDates = serverDates ?? localDates;
  const today = new Date();

  // Build 84 days (12 weeks) going back from today
  const days: { date: string; studied: boolean; isToday: boolean }[] = [];
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().split("T")[0]!;
    days.push({
      date: iso,
      studied: studyDates.has(iso),
      isToday: i === 0,
    });
  }

  // Pad the start to align to Monday
  const firstDay = new Date(today);
  firstDay.setDate(firstDay.getDate() - 83);
  const startPad = (firstDay.getDay() + 6) % 7; // 0=Mon

  const padded = Array(startPad).fill(null).concat(days);

  const studiedCount = days.filter((d) => d.studied).length;

  return (
    <div className="max-w-full">
      <div className="mb-2.5 flex items-center justify-between gap-4">
        <p className="section-label mb-0">Study activity</p>
        <p className="shrink-0 font-mono text-[11px] text-on-muted/60">
          {studiedCount}/84 days
        </p>
      </div>
      <div className={cn("pb-1", fullWidth ? "w-full" : "overflow-x-auto")}>
        <div
          className={cn("gap-[3px]", fullWidth ? "grid w-full" : "inline-grid")}
          style={{ gridTemplateColumns: fullWidth ? "repeat(12, minmax(0, 1fr))" : "repeat(12, max-content)" }}
          aria-label="Study activity heatmap"
        >
          {Array.from({ length: 12 }, (_, week) => (
            <div key={week} className="flex flex-col gap-[3px]">
              {Array.from({ length: 7 }, (_, day) => {
                const idx = week * 7 + day;
                const cell = padded[idx];
                if (!cell) {
                  return <div key={day} className={cn("rounded-[2px] bg-transparent", fullWidth ? "w-full aspect-square" : "size-2.5")} />;
                }
                return (
                  <div
                    key={day}
                    title={cell.date}
                    className={cn(
                      "rounded-[2px] transition-colors",
                      fullWidth ? "w-full aspect-square" : "size-2.5",
                      cell.isToday && "ring-1 ring-accent/50",
                      cell.studied
                        ? "bg-accent/75 shadow-[0_0_0_1px_rgb(212_162_74/0.22)]"
                        : "bg-surface-muted/55",
                    )}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2.5 flex items-center gap-1.5 text-[10px] text-on-muted/50">
        <div className="size-2 rounded-[2px] bg-surface-muted/50" />
        <span>No study</span>
        <div className="ml-2 size-2 rounded-[2px] bg-accent/70" />
        <span>Studied</span>
      </div>
    </div>
  );
}

const SUGGESTIONS = [
  "How does TCP work?",
  "React useEffect",
  "Transformer architecture",
  "SQL indexes",
  "Public key cryptography",
];

export function DashboardPage() {
  const navigate = useNavigate();
  const [starting, setStarting] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [generating, setGenerating] = useState(false);
  const [showNewInput, setShowNewInput] = useState(false);
  const newInputRef = useRef<HTMLInputElement>(null);
  const localStreak = getStudyStreak();

  const { data: streakData, refetch: refetchStreak } = useQuery({
    queryKey: ["streak"],
    queryFn: fetchStreak,
    staleTime: 60_000,
  });
  const streak = streakData?.streak ?? localStreak;
  const serverDates = useMemo(
    () => streakData ? new Set(streakData.dates) : undefined,
    [streakData],
  );

  async function handleQuickStart(q: string) {
    const trimmed = q.trim();
    if (!trimmed || generating) return;
    setGenerating(true);
    try {
      const { topic_id } = await generateTopic(trimmed);
      recordTopicUse(topic_id);
      recordStudyDay();
      void postStudyDay().then(() => void refetchStreak());
      const session = await startSession(topic_id, "resume");
      navigate(`/session/${session.session_id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create topic — try rephrasing");
      setGenerating(false);
    }
  }

  const { data: dueData } = useQuery({
    queryKey: ["due"],
    queryFn: () => fetchDue(),
    staleTime: 60_000,
  });

  const { data: topicsData, isLoading: topicsLoading } = useQuery({
    queryKey: ["topics", "", false],
    queryFn: () => fetchTopics({ q: "", includeArchived: false }),
    staleTime: 30_000,
  });

  const dueItems = dueData?.items ?? [];
  const dueCount = dueItems.length;

  const ranked = rankTopics(topicsData ?? []);
  const inProgress = ranked.filter((t) => t.started);
  const continueTopics = inProgress.slice(0, 5);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

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
  const selectedTopic = useMemo(
    () => continueTopics.find((t) => t.id === selectedTopicId) ?? continueTopics[0] ?? null,
    [continueTopics, selectedTopicId],
  );
  const selectedSignal = useMemo(
    () => (selectedTopic ? focusSignal(selectedTopic) : null),
    [selectedTopic],
  );
  const otherTopics = useMemo(
    () => continueTopics.filter((t) => t.id !== selectedTopic?.id),
    [continueTopics, selectedTopic],
  );

  useEffect(() => {
    if (continueTopics.length === 0) {
      setSelectedTopicId(null);
      return;
    }
    if (!selectedTopicId || !continueTopics.some((t) => t.id === selectedTopicId)) {
      setSelectedTopicId(continueTopics[0].id);
    }
  }, [continueTopics, selectedTopicId]);

  async function begin(topicId: string, mode: "resume" | "replay" = "resume") {
    setStarting(topicId);
    recordTopicUse(topicId);
    recordStudyDay();
    void postStudyDay().then(() => void refetchStreak());
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
      toast.error(e instanceof Error ? e.message : "Could not start session");
    } finally {
      setStarting(null);
    }
  }

  const hasData = topicsData !== undefined;
  const hasActivity = inProgress.length > 0;

  return (
    <AppShell>
      <PageScaffold
        tier="wide"
        contentClassName="[&>div]:pt-5 [&>div]:pb-6"
      >
        {topicsLoading && <DashboardSkeleton />}
        <div className={cn("flex flex-col gap-5", topicsLoading && "hidden")}>

          {/* ── Header: Greeting + KPI strip ── */}
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-start justify-between gap-2.5">
              <div>
                <h1 className="font-display text-2xl font-semibold text-on-surface">
                  {greeting()}
                </h1>
                <p className="mt-0.5 text-sm text-on-muted">
                  {dueCount > 0
                    ? `${dueCount} concept${dueCount !== 1 ? "s" : ""} waiting for review.`
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
            </div>
          </div>

          {/* ── Today's Mission (solo mode when no active topics) ── */}
          {hasData && recommendation && !hasActivity && (
            <div className="rounded-xl border border-line/40 bg-surface/20 p-4 md:p-5">
              <div className="flex flex-col gap-3.5 md:flex-row md:items-end md:justify-between">
                <div className="min-w-0">
                  <p className="section-label mb-0">{recommendation.label}</p>
                  <h2 className="mt-1 font-display text-[1.7rem] font-semibold text-on-surface md:text-[1.8rem]">
                    {recommendation.topic.display_name}
                  </h2>
                  <p className="mt-1 text-sm text-on-muted">{recommendation.subtext}</p>
                </div>

                <div className="flex flex-wrap gap-2.5 shrink-0">
                  <Button
                    size="sm"
                    disabled={!!starting}
                    onClick={() => void begin(recommendation.topic.id, recommendation.mode)}
                    className="md:px-4.5"
                  >
                    {starting === recommendation.topic.id ? "Starting…" : "Start session"}
                    <ArrowRight className="size-4" />
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <Link to={`/topics/${recommendation.topic.id}`} className="text-on-muted/70">
                      View topic
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── Quick-start (empty state hero) ── */}
          {hasData && !hasActivity && (
            <div className="rounded-2xl border border-line/40 bg-surface/20 px-6 py-8">
              <div className="mx-auto max-w-lg">
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/12">
                    <BookOpen className="size-5 text-accent" />
                  </span>
                  <div>
                    <p className="font-display text-lg font-semibold text-on-surface">
                      What do you want to understand?
                    </p>
                    <p className="text-sm text-on-muted">
                      Type any concept and Quest builds a study path instantly.
                    </p>
                  </div>
                </div>

                {/* Input row */}
                <form
                  className="flex gap-2"
                  onSubmit={(e) => { e.preventDefault(); void handleQuickStart(query); }}
                >
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder='e.g. "how TCP handshakes work"'
                    disabled={generating}
                    className={cn(
                      "flex-1 rounded-xl border border-line/50 bg-surface/40 px-4 py-2.5 text-sm text-on-surface placeholder:text-on-muted/45",
                      "outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 transition-colors",
                      "disabled:opacity-50",
                    )}
                  />
                  <Button type="submit" disabled={!query.trim() || generating} className="shrink-0 gap-1.5">
                    {generating ? (
                      <><Loader2 className="size-4 animate-spin" /> Building…</>
                    ) : (
                      <><Send className="size-4" /> Study this</>
                    )}
                  </Button>
                </form>

                {/* Suggestion chips */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={generating}
                      onClick={() => void handleQuickStart(s)}
                      className="rounded-full border border-line/40 bg-surface/30 px-3 py-1 text-xs text-on-muted transition-colors hover:border-accent/30 hover:text-accent disabled:pointer-events-none disabled:opacity-40"
                    >
                      {s}
                    </button>
                  ))}
                </div>

                <p className="mt-5 text-center text-xs text-on-muted/50">
                  or{" "}
                  <Link to="/topics" className="text-on-muted/70 underline-offset-2 hover:text-accent hover:underline">
                    browse the library
                  </Link>
                </p>
              </div>
            </div>
          )}

          {/* ── Study something new (active users) ── */}
          {hasActivity && (
            <div className="flex items-center gap-2">
              {showNewInput ? (
                <form
                  className="flex flex-1 gap-2"
                  onSubmit={(e) => { e.preventDefault(); void handleQuickStart(query); }}
                >
                  <input
                    ref={newInputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="What do you want to understand?"
                    disabled={generating}
                    className={cn(
                      "flex-1 rounded-xl border border-line/50 bg-surface/40 px-3.5 py-2 text-sm text-on-surface placeholder:text-on-muted/45",
                      "outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 transition-colors",
                      "disabled:opacity-50",
                    )}
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Escape") { setShowNewInput(false); setQuery(""); } }}
                  />
                  <Button size="sm" type="submit" disabled={!query.trim() || generating} className="shrink-0">
                    {generating ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                  </Button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => { setShowNewInput(true); setTimeout(() => newInputRef.current?.focus(), 50); }}
                  className="flex items-center gap-1.5 rounded-lg border border-dashed border-line/40 px-3 py-1.5 text-xs text-on-muted/60 transition-colors hover:border-accent/30 hover:text-accent"
                >
                  <Plus className="size-3.5" />
                  Study something new
                </button>
              )}
            </div>
          )}

          {/* ── Unified board (viewport-aware) ── */}
          {hasActivity && (
            <section className="flex min-h-112 flex-col gap-3 rounded-2xl border border-line/35 bg-surface/12 p-3 lg:h-[min(72vh,calc(100dvh-12.75rem))]">
              <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="min-h-0 overflow-y-auto pr-1">
                  {selectedTopic && (
                    <div
                      className={cn(
                        "group relative mb-3 overflow-hidden rounded-xl border border-accent/22 bg-accent-dim/8 px-4 py-3.5",
                        "transition-[border-color,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
                      )}
                      onPointerMove={(event) => {
                        if (
                          typeof window !== "undefined" &&
                          !window.matchMedia("(hover: hover) and (pointer: fine)").matches
                        ) {
                          return;
                        }
                        const el = event.currentTarget;
                        const rect = el.getBoundingClientRect();
                        const rx = (event.clientX - rect.left - rect.width / 2) / rect.width;
                        const ry = (event.clientY - rect.top - rect.height / 2) / rect.height;
                        el.style.setProperty("--fx", `${(rx * 18).toFixed(2)}px`);
                        el.style.setProperty("--fy", `${(ry * 14).toFixed(2)}px`);
                      }}
                      onPointerLeave={(event) => {
                        const el = event.currentTarget;
                        el.style.setProperty("--fx", "0px");
                        el.style.setProperty("--fy", "0px");
                      }}
                    >
                      <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 opacity-85"
                      >
                        <div
                          className="absolute -left-24 -top-24 h-56 w-56 rounded-full bg-accent/10 blur-3xl opacity-70"
                          style={{ transform: "translate3d(var(--fx, 0px), var(--fy, 0px), 0)" }}
                        />
                        <div
                          className="absolute -bottom-24 -right-24 h-56 w-56 rounded-full bg-score-good/8 blur-3xl opacity-60"
                          style={{ transform: "translate3d(calc(var(--fx, 0px) * -0.7), calc(var(--fy, 0px) * -0.7), 0)" }}
                        />
                      </div>
                      <div
                        aria-hidden
                        className="pointer-events-none absolute -inset-24 opacity-0 transition-opacity duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:opacity-100"
                      >
                        <div
                          className="absolute inset-0 rotate-12 bg-linear-to-r from-transparent via-white/8 to-transparent"
                          style={{ transform: "translate3d(var(--fx, 0px), var(--fy, 0px), 0)" }}
                        />
                      </div>
                      <div className="relative">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="section-label mb-0">Current focus</p>
                            <p className="mt-0.5 text-[11px] leading-snug text-on-muted/70">
                              A single good move beats a long session.
                            </p>
                          </div>
                          <p
                            className={cn(
                              "shrink-0 rounded-full border border-line/25 bg-surface/10 px-2 py-0.5 text-[10px] font-medium",
                              selectedSignal?.tone,
                            )}
                          >
                            {selectedSignal?.label}
                          </p>
                        </div>
                        <h2 className="mt-1 font-display text-[1.55rem] font-semibold text-on-surface md:text-[1.7rem]">
                          {selectedTopic.display_name}
                        </h2>
                        <p className="mt-1 text-xs text-on-muted/75">
                          {selectedTopic.mastered_count}/{selectedTopic.concept_count} mastered
                          {selectedTopic.avg_score_1_to_5 > 0 ? ` · ${selectedTopic.avg_score_1_to_5.toFixed(1)}/5` : ""}
                          {selectedTopic.due_count > 0 ? ` · ${selectedTopic.due_count} due` : ""}
                        </p>
                        <p className="mt-2 text-sm leading-snug text-on-muted">
                          Next step: <span className="text-on-surface/90">{selectedSignal?.nextStep}</span>
                        </p>
                        <div className="mt-3 flex shrink-0 flex-wrap gap-2">
                          <Button
                            size="sm"
                            disabled={starting === selectedTopic.id}
                            onClick={() => void begin(selectedTopic.id)}
                          >
                            {starting === selectedTopic.id ? "Starting…" : "Continue"}
                            <ArrowRight className="size-4" />
                          </Button>
                          <Button asChild size="sm" variant="ghost">
                            <Link to={`/topics/${selectedTopic.id}`} className="text-on-muted/70">
                              View topic
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  <h2 className="section-label mb-2">{selectedTopic ? "Other threads" : "Threads"}</h2>
                  <div className="flex flex-col gap-1.5">
                    {otherTopics.map((topic) => {
                      const isSelected = topic.id === selectedTopic?.id;
                      const score = topic.avg_score_1_to_5;
                      return (
                        <button
                          type="button"
                          key={topic.id}
                          onClick={() => setSelectedTopicId(topic.id)}
                          className={cn(
                            "w-full text-left flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 transition-colors",
                            isSelected
                              ? "border-accent/25 bg-accent-dim/15"
                              : "border-line/35 bg-surface/20 hover:border-line/55 hover:bg-surface/30",
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-medium text-on-surface">
                                {topic.display_name}
                              </p>
                              {topic.due_count > 0 && (
                                <span className="shrink-0 rounded-full bg-accent-dim px-1.5 py-0.5 font-mono text-[10px] font-semibold text-accent">
                                  {topic.due_count} due
                                </span>
                              )}
                              {score > 0 && (
                                <span className={cn(
                                  "shrink-0 rounded-full border px-1.5 py-0.5 font-mono text-[10px]",
                                  score >= 4 ? "border-score-good/35 bg-score-good/8 text-score-good" :
                                  score >= 3 ? "border-score-mid/35 bg-score-mid/10 text-score-mid" :
                                  "border-score-low/30 bg-score-low/8 text-score-low",
                                )}>
                                  {score.toFixed(1)}/5
                                </span>
                              )}
                            </div>
                            <div className="mt-1.5">
                              <MasteryTicks score={score} />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                    {otherTopics.length === 0 && (
                      <p className="rounded-lg border border-line/20 bg-surface/10 px-3 py-2 text-xs text-on-muted/60">
                        No other active topics yet.
                      </p>
                    )}
                    {inProgress.length > continueTopics.length && (
                      <Link
                        to="/topics"
                        className="mt-0.5 text-center text-xs text-on-muted/55 hover:text-accent"
                      >
                        +{inProgress.length - continueTopics.length} more active →
                      </Link>
                    )}
                  </div>
                </div>

                <div className="min-h-0 space-y-3 overflow-y-auto pl-1">
                  {hasData && (
                    <div className="rounded-xl border border-line/35 bg-surface/15 p-3.5">
                      <div className="mb-2.5 flex items-center justify-between gap-2">
                        <h2 className="section-label mb-0">Overall</h2>
                        <Link to="/mastery" className="text-[11px] text-on-muted/60 hover:text-on-surface">
                          Full breakdown →
                        </Link>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: "Threads active", value: String(inProgress.length), tone: "text-accent" },
                          { label: "Mastery", value: totalConcepts > 0 ? `${masteryPct}%` : "—", tone: totalMastered > 0 ? "text-score-good" : "text-on-muted" },
                          { label: dueCount > 0 ? "In queue" : "Reinforced", value: String(dueCount), tone: dueCount > 0 ? "text-score-low" : "text-score-good" },
                        ].map((item) => (
                          <div key={item.label} className="rounded-lg border border-line/30 bg-surface/20 px-2.5 py-2">
                            <p className={cn("font-mono text-sm font-semibold tabular-nums leading-none", item.tone)}>
                              {item.value}
                            </p>
                            <p className="mt-1 text-[10px] text-on-muted/60">{item.label}</p>
                          </div>
                        ))}
                      </div>
                      {dueByTopic[0] && (
                        <div className="mt-2.5 rounded-lg border border-line/25 bg-surface/12 px-2.5 py-2 text-xs text-on-muted/70">
                          Top due: <span className="text-on-surface">{dueByTopic[0][0].replace(/_/g, " ")}</span> ({dueByTopic[0][1]})
                        </div>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2.5 w-full"
                        asChild
                      >
                        <Link to="/due">
                          <CalendarCheck className="size-3.5" />
                          Enter queue
                        </Link>
                      </Button>
                    </div>
                  )}

                  {hasData && (
                    <div className="rounded-xl border border-line/35 bg-surface/15 p-3">
                      <ActivityHeatmap fullWidth studyDates={serverDates} />
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* ── Activity Heatmap ── */}
          {hasData && !hasActivity && (
            <div className="w-full rounded-xl border border-line/35 bg-surface/15 p-3 sm:w-fit">
              <ActivityHeatmap studyDates={serverDates} />
            </div>
          )}

        </div>
      </PageScaffold>
    </AppShell>
  );
}
