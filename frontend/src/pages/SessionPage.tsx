import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  fetchSession,
  fetchSessionTurns,
  fetchTopicGraph,
  finishSession,
  startSession,
  submitTurn,
} from "@/api/client";
import type { GraphNode, SessionView } from "@/api/types";
import { ActiveCycle } from "@/components/ActiveCycle";
import { AnswerBar } from "@/components/AnswerBar";
import { AppShell } from "@/components/AppShell";
import { ContentTrack } from "@/components/ContentColumn";
import { SessionCompletePanel } from "@/components/SessionCompletePanel";
import { SessionPanel } from "@/components/SessionPanel";
import { SessionWorkspace } from "@/components/SessionWorkspace";
import { Skeleton } from "@/components/Skeleton";
import { Button } from "@/components/ui/button";
import { gutterPx } from "@/lib/layout";
import { cn } from "@/lib/utils";
import {
  buildExchangesFromTurns,
  firstSentence,
  type CompletedCycle,
  type CycleExchange,
} from "@/lib/cycles";
import { setActiveSession } from "@/lib/activeSession";

export function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<SessionView | null>(null);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [startingFresh, setStartingFresh] = useState(false);
  const [continuingStudy, setContinuingStudy] = useState(false);
  const [wrappingUp, setWrappingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitCount, setSubmitCount] = useState(0);

  // Cycle state
  const [completedCycles, setCompletedCycles] = useState<CompletedCycle[]>([]);
  const [activeConceptName, setActiveConceptName] = useState<string | null>(null);
  const [activeExchanges, setActiveExchanges] = useState<CycleExchange[]>([]);
  const [expandedCycleIds, setExpandedCycleIds] = useState<Set<string>>(new Set());

  // Right panel
  const [topicNodes, setTopicNodes] = useState<GraphNode[]>([]);

  const load = useCallback(async () => {
    if (!sessionId) return;
    setError(null);
    try {
      const [view, turns] = await Promise.all([
        fetchSession(sessionId),
        fetchSessionTurns(sessionId),
      ]);
      setSession(view);
      if (!view.done && view.topic_id) {
        setActiveSession({
          sessionId: view.session_id,
          topicDisplay: view.topic_display ?? view.topic_id,
          topicId: view.topic_id,
        });
      } else {
        setActiveSession(null);
      }

      // If there are prior turns (resumed session), bundle them as one chip
      if (turns.length > 0) {
        const exchanges = buildExchangesFromTurns(turns);
        const lastEval = [...exchanges].reverse().find((e) => e.eval != null)?.eval;
        const priorCycle: CompletedCycle = {
          id: "prior-session",
          conceptName: view.topic_display ?? "Prior session",
          exchanges,
          finalScore: lastEval?.score ?? 3,
          summary: lastEval ? firstSentence(lastEval.reasoning) : `${exchanges.length} exchanges`,
        };
        setCompletedCycles([priorCycle]);
      } else {
        setCompletedCycles([]);
      }

      setActiveExchanges([]);
      setActiveConceptName(view.focus ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Session not found");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      navigate("/topics", { replace: true });
      return;
    }
    void load();
  }, [sessionId, load, navigate]);

  useEffect(() => {
    if (!session?.topic_id) return;
    fetchTopicGraph(session.topic_id)
      .then((g) => setTopicNodes(g.nodes))
      .catch(() => {});
  }, [session?.topic_id]);

  async function onSubmit() {
    if (!sessionId || !answer.trim() || submitting || !session?.waiting_for_answer) {
      return;
    }
    const text = answer.trim();
    const prevFocus = session.focus;
    const currentQuestion = session.tutor_message ?? "";

    setSubmitting(true);
    setError(null);
    try {
      const next = await submitTurn(sessionId, text);

      const newExchange: CycleExchange = {
        id: `e-${Date.now()}`,
        question: currentQuestion,
        answer: text,
        eval: next.last_evaluation
          ? {
              score: next.last_evaluation.score,
              gaps: next.last_evaluation.gaps,
              reasoning: next.last_evaluation.reasoning,
            }
          : null,
      };

      const focusChanged = next.focus != null && next.focus !== prevFocus;

      if (focusChanged) {
        // Compress the active concept cycle into a chip
        const allExchanges = [...activeExchanges, newExchange];
        const lastEval = newExchange.eval;
        const completed: CompletedCycle = {
          id: `cycle-${prevFocus ?? Date.now()}`,
          conceptName: prevFocus ?? activeConceptName ?? "Concept",
          exchanges: allExchanges,
          finalScore: lastEval?.score ?? 3,
          summary: lastEval ? firstSentence(lastEval.reasoning) : "",
        };
        setCompletedCycles((prev) => [...prev, completed]);
        setActiveExchanges([]);
        setActiveConceptName(next.focus);
      } else {
        // Continue accumulating in the active concept cycle
        setActiveExchanges((prev) => [...prev, newExchange]);
        if (!activeConceptName && next.focus) {
          setActiveConceptName(next.focus);
        }
      }

      setSession(next);
      setAnswer("");
      setSubmitCount((n) => n + 1);

      if (next.done) {
        setActiveSession(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setSubmitting(false);
    }
  }

  async function continueStudy() {
    if (!session?.topic_id) return;
    setContinuingStudy(true);
    setError(null);
    try {
      const next = await startSession(session.topic_id, "resume");
      navigate(`/session/${next.session_id}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start");
      setContinuingStudy(false);
    }
  }

  async function startFreshRun() {
    if (!session?.topic_id) return;
    setStartingFresh(true);
    setError(null);
    try {
      const next = await startSession(session.topic_id, "replay");
      navigate(`/session/${next.session_id}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start");
      setStartingFresh(false);
    }
  }

  async function wrapUp() {
    if (!sessionId || wrappingUp) return;
    setWrappingUp(true);
    setError(null);
    try {
      const finished = await finishSession(sessionId);
      setSession(finished);
      setActiveSession(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not wrap up");
      setWrappingUp(false);
    }
  }

  function toggleCycle(id: string) {
    setExpandedCycleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!sessionId) return null;

  const isActive = !!session && !session.done && session.waiting_for_answer;

  const scoreHistory = [
    ...completedCycles.flatMap((c) => c.exchanges),
    ...activeExchanges,
  ]
    .filter((e) => e.eval != null)
    .map((e) => e.eval!.score);

  const visitedConceptNames = new Set(completedCycles.map((c) => c.conceptName));

  const keyGaps = Array.from(
    new Set(
      completedCycles
        .flatMap((c) => c.exchanges)
        .filter((e) => e.eval && e.eval.score <= 3 && e.eval.gaps.length > 0)
        .flatMap((e) => e.eval!.gaps),
    ),
  ).slice(0, 3);

  return (
    <AppShell
      topicSession={
        session?.topic_display
          ? { name: session.topic_display, live: !!session && !session.done }
          : undefined
      }
      inSession={!!session && !session.done}
      exitTo={session?.topic_id ? `/topics/${session.topic_id}` : "/topics"}
    >
      {loading && (
        <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", gutterPx, "py-page")}>
          <ContentTrack tier="reading" className="flex flex-col gap-section">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <div className="flex items-center gap-2 text-xs text-on-muted/50">
              <span className="size-3 animate-spin rounded-full border border-line border-t-accent" />
              Generating your first question…
            </div>
          </ContentTrack>
        </div>
      )}

      {error && !session && !loading && (
        <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", gutterPx, "py-page")}>
          <ContentTrack tier="reading">
            <p className="text-score-low">{error}</p>
            <Link to="/topics" className="mt-4 inline-block text-accent">
              ← Topics
            </Link>
          </ContentTrack>
        </div>
      )}

      {session && !loading && session.done && (
        <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", gutterPx, "py-page")}>
          <ContentTrack tier="reading">
            <SessionCompletePanel
              session={session}
              onContinueStudy={continueStudy}
              onStartFresh={startFreshRun}
              continuingStudy={continuingStudy}
              startingFresh={startingFresh}
            />
          </ContentTrack>
        </div>
      )}

      {session && !loading && !session.done && (
        <SessionWorkspace
          className="min-w-0 flex-1"
          cycles={completedCycles}
          expandedCycleIds={expandedCycleIds}
          onToggleCycle={toggleCycle}
          scrollTrigger={submitCount}
          panel={
            <SessionPanel
              scores={scoreHistory}
              nodes={topicNodes}
              visitedNames={visitedConceptNames}
              activeName={activeConceptName}
              keyGaps={keyGaps}
              onWrapUp={() => void wrapUp()}
              wrappingUp={wrappingUp}
            />
          }
          activeContent={
            <ActiveCycle
              conceptName={activeConceptName}
              exchanges={activeExchanges}
              currentQuestion={
                session.waiting_for_answer ? session.tutor_message : null
              }
              error={error}
            />
          }
          pinnedBottom={
            isActive ? (
              <AnswerBar
                value={answer}
                onChange={setAnswer}
                onSubmit={() => void onSubmit()}
                submitting={submitting}
              />
            ) : (
              <div className={cn(gutterPx, "py-4")}>
                <ContentTrack tier="reading">
                  <div className="rounded-2xl border border-line/50 bg-surface/30 px-5 py-4 text-sm">
                    <p className="font-medium text-on-surface">Session paused</p>
                    <p className="mt-2 text-on-muted">
                      Start a new session to get a fresh question.
                    </p>
                    <Button
                      className="mt-4"
                      size="sm"
                      disabled={submitting}
                      onClick={() => void startFreshRun()}
                    >
                      New session
                    </Button>
                  </div>
                </ContentTrack>
              </div>
            )
          }
        />
      )}
    </AppShell>
  );
}
