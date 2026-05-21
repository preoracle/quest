import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import {
  fetchSession,
  fetchSessionTurns,
  startSession,
  submitTurn,
} from "@/api/client";
import type { SessionView } from "@/api/types";
import { AnswerBar } from "@/components/AnswerBar";
import { AppShell } from "@/components/AppShell";
import { QuestionHero } from "@/components/QuestionHero";
import { SessionReportView } from "@/components/SessionReportView";
import { Skeleton } from "@/components/Skeleton";
import { TurnHistory } from "@/components/TurnHistory";
import { Button } from "@/components/ui/button";
import {
  appendTurnResult,
  splitActiveQuestion,
  turnsToTranscript,
  type TranscriptEntry,
} from "@/lib/transcript";

export function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<SessionView | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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
        const turns = await fetchSessionTurns(sessionId);
        setTranscript(turnsToTranscript(turns));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setSubmitting(false);
    }
  }

  if (!sessionId) return null;

  const activeQuestion =
    session && !session.done && session.waiting_for_answer
      ? session.tutor_message
      : null;
  const { history } = splitActiveQuestion(transcript, activeQuestion);
  const masteryScore = session?.last_evaluation?.score;
  const isActive =
    !!session && !session.done && session.waiting_for_answer;

  return (
    <AppShell
      topicLabel={session?.topic_display}
      inSession={!!session && !session.done}
      masteryScore={masteryScore}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {loading && (
          <div className="space-y-6 px-5 py-8 lg:px-8">
            <Skeleton className="h-48 w-full max-w-[44rem] rounded-xl" />
            <Skeleton className="h-24 w-full max-w-[44rem]" />
          </div>
        )}

        {error && (
          <div className="px-5 py-8 lg:px-8">
            <div className="card max-w-[44rem] border-score-low/30 p-6 text-sm">
              <p className="text-score-low">{error}</p>
              <Link to="/topics" className="mt-4 inline-block text-accent">
                ← Back to topics
              </Link>
            </div>
          </div>
        )}

        {session && !loading && !error && session.done && (
          <div className="flex-1 overflow-y-auto px-5 py-8 lg:px-8">
            <div className="mx-auto max-w-[44rem] space-y-8">
              <div className="flex items-center gap-3">
                <span className="flex size-12 items-center justify-center rounded-xl bg-score-good/15 text-score-good">
                  <CheckCircle2 className="size-6" />
                </span>
                <div>
                  <h1 className="font-display text-2xl font-semibold text-on-surface">
                    Session complete
                  </h1>
                  <p className="text-sm text-on-muted">{session.topic_display}</p>
                </div>
              </div>
              {session.report ? (
                <SessionReportView report={session.report} />
              ) : (
                <p className="text-on-muted">{session.summary ?? "Well done."}</p>
              )}
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link to="/topics">More topics</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/mastery">View progress</Link>
                </Button>
              </div>
            </div>
          </div>
        )}

        {session && !loading && !error && !session.done && (
          <>
            <div className="shrink-0 px-5 pt-6 pb-4 lg:px-8">
              <div className="mx-auto max-w-[44rem]">
                {activeQuestion ? (
                  <QuestionHero
                    question={activeQuestion}
                    focus={session.focus}
                  />
                ) : (
                  <div className="card border-accent/30 bg-accent-dim/30 p-5">
                    <p className="text-sm font-medium text-on-surface">
                      Session paused or out of sync
                    </p>
                    <p className="mt-2 text-sm text-on-muted">
                      This can happen after calibration or an interrupted session.
                      Start a new session to get a fresh Socratic question.
                    </p>
                    <Button
                      className="mt-4"
                      size="sm"
                      disabled={submitting}
                      onClick={() => {
                        setSubmitting(true);
                        void startSession(session.topic_id, "study")
                          .then((s) =>
                            navigate(`/session/${s.session_id}`, { replace: true }),
                          )
                          .catch((e) =>
                            setError(e instanceof Error ? e.message : "Could not start"),
                          )
                          .finally(() => setSubmitting(false));
                      }}
                    >
                      New session
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 lg:px-8">
              <div className="mx-auto max-w-[44rem] pb-4">
                <TurnHistory entries={history} />
              </div>
            </div>

            {isActive && (
              <AnswerBar
                value={answer}
                onChange={setAnswer}
                onSubmit={() => void onSubmit()}
                submitting={submitting}
              />
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
