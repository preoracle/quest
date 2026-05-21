import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  fetchSession,
  fetchSessionTurns,
  startSession,
  submitTurn,
} from "@/api/client";
import type { SessionView } from "@/api/types";
import { AnswerBar } from "@/components/AnswerBar";
import { AppShell } from "@/components/AppShell";
import { ContentTrack } from "@/components/ContentColumn";
import { QuestionHero } from "@/components/QuestionHero";
import { SessionCompletePanel } from "@/components/SessionCompletePanel";
import { SessionScaffold } from "@/components/SessionScaffold";
import { Skeleton } from "@/components/Skeleton";
import { TurnHistory } from "@/components/TurnHistory";
import { Button } from "@/components/ui/button";
import { gutterPx, pagePy } from "@/lib/layout";
import { cn } from "@/lib/utils";
import {
  appendTurnResult,
  splitActiveQuestion,
  turnsToTranscript,
  type TranscriptEntry,
} from "@/lib/transcript";
import { setActiveSession } from "@/lib/activeSession";

export function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<SessionView | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [startingFresh, setStartingFresh] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnSeed, setTurnSeed] = useState(0);

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
      let entries = turnsToTranscript(turns);
      if (
        view.waiting_for_answer &&
        view.tutor_message &&
        (entries.length === 0 ||
          entries[entries.length - 1]?.kind !== "tutor" ||
          (entries[entries.length - 1] as { text: string }).text !==
            view.tutor_message)
      ) {
        entries = [
          ...entries.filter((e) => e.id !== "t-pending"),
          { id: "t-pending", kind: "tutor", text: view.tutor_message },
        ];
      }
      setTranscript(entries);
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

  async function onSubmit() {
    if (!sessionId || !answer.trim() || submitting || !session?.waiting_for_answer) {
      return;
    }
    const text = answer.trim();
    setSubmitting(true);
    setError(null);
    try {
      const next = await submitTurn(sessionId, text);
      const seed = turnSeed + 1;
      setTurnSeed(seed);
      setTranscript((prev) =>
        appendTurnResult(
          prev.filter((x) => x.id !== "t-pending"),
          text,
          next.last_evaluation,
          next.waiting_for_answer ? next.tutor_message : null,
          seed,
        ),
      );
      setSession(next);
      setAnswer("");
      if (next.done) {
        setActiveSession(null);
        const turns = await fetchSessionTurns(sessionId);
        setTranscript(turnsToTranscript(turns));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setSubmitting(false);
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

  if (!sessionId) return null;

  const activeQuestion =
    session && !session.done && session.waiting_for_answer
      ? session.tutor_message
      : null;
  const { history } = splitActiveQuestion(transcript, activeQuestion);
  const masteryScore = session?.last_evaluation?.score;
  const isActive = !!session && !session.done && session.waiting_for_answer;
  const turnsAnswered = transcript.filter((e) => e.kind === "eval").length;

  return (
    <AppShell
      topicSession={
        session?.topic_display
          ? { name: session.topic_display, live: !!session && !session.done }
          : undefined
      }
      inSession={!!session && !session.done}
      exitTo={session?.topic_id ? `/topics/${session.topic_id}` : "/topics"}
      masteryScore={masteryScore}
    >
      {loading && (
        <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", gutterPx, pagePy)}>
          <ContentTrack tier="reading" className="flex flex-col gap-section">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </ContentTrack>
        </div>
      )}

      {error && !session && !loading && (
        <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", gutterPx, pagePy)}>
          <ContentTrack tier="reading">
            <p className="text-score-low">{error}</p>
            <Link to="/topics" className="mt-4 inline-block text-accent">
              ← Topics
            </Link>
          </ContentTrack>
        </div>
      )}

      {session && !loading && session.done && (
        <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", gutterPx, pagePy)}>
          <ContentTrack tier="reading">
            <SessionCompletePanel
              session={session}
              onStartFresh={startFreshRun}
              startingFresh={startingFresh}
            />
          </ContentTrack>
        </div>
      )}

      {session && !loading && !session.done && (
        <SessionScaffold
          turnsAnswered={turnsAnswered}
          scrollTrigger={turnSeed}
          pinnedQuestion={
            activeQuestion ? (
              <QuestionHero question={activeQuestion} focus={session.focus} />
            ) : (
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
            )
          }
          scroll={
            <>
              <TurnHistory entries={history} />
              {error && (
                <p className="mt-3 text-xs text-score-low">{error}</p>
              )}
            </>
          }
          pinnedBottom={
            isActive ? (
              <AnswerBar
                value={answer}
                onChange={setAnswer}
                onSubmit={() => void onSubmit()}
                submitting={submitting}
              />
            ) : undefined
          }
        />
      )}
    </AppShell>
  );
}
