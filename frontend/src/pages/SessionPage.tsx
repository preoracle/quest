import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { fetchSession, submitTurn } from "../api/client";
import type { SessionView } from "../api/types";
import { EvaluationPanel } from "../components/EvaluationPanel";
import { Layout } from "../components/Layout";
import { MasteryBar } from "../components/MasteryBar";
import { PromptBlock } from "../components/PromptBlock";

export function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const initial = (location.state as { session?: SessionView } | null)?.session;

  const [session, setSession] = useState<SessionView | null>(initial ?? null);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(!initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sessionId) return;
    setError(null);
    try {
      const view = await fetchSession(sessionId);
      setSession(view);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Session not found");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      navigate("/", { replace: true });
      return;
    }
    if (!initial) void load();
  }, [sessionId, initial, load, navigate]);

  async function onSubmit(e?: FormEvent) {
    e?.preventDefault();
    if (!sessionId || !answer.trim() || submitting || !session?.waiting_for_answer) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const next = await submitTurn(sessionId, answer.trim());
      setSession(next);
      setAnswer("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setSubmitting(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void onSubmit();
    }
  }

  if (!sessionId) return null;

  const depthScore = session?.last_evaluation?.score ?? 0;
  const focusLabel = session?.focus?.replace(/_/g, " ") ?? null;

  return (
    <Layout
      topicLabel={session?.topic_display}
      sessionDepth={session ? depthScore : undefined}
    >
      <div className="flex min-h-[calc(100vh-4rem)] flex-col">
        {session && (
          <div className="border-b border-outline-variant bg-surface px-6 py-3 lg:hidden">
            <div className="mx-auto flex max-w-reading items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                Session depth
              </span>
              <MasteryBar score={depthScore} />
            </div>
          </div>
        )}

        <section className="relative z-10 flex flex-1 flex-col items-center overflow-y-auto px-6 py-12 md:px-16">
          {loading && (
            <p className="font-mono text-sm uppercase tracking-widest text-on-surface-variant">
              Loading session…
            </p>
          )}

          {error && (
            <div className="max-w-reading w-full">
              <p className="border border-outline-variant px-4 py-3 font-mono text-sm text-on-surface-variant">
                {error}
              </p>
              <Link
                to="/"
                className="mt-6 inline-block font-mono text-xs uppercase tracking-widest text-secondary"
              >
                ← Back to catalog
              </Link>
            </div>
          )}

          {session && !loading && (
            <div className="w-full max-w-reading space-y-12">
              {focusLabel && (
                <p className="font-mono text-xs uppercase tracking-widest text-on-surface-variant">
                  Focus · {focusLabel}
                </p>
              )}

              {session.done ? (
                <div className="space-y-8">
                  <h2 className="font-display text-3xl font-semibold">Inquiry complete</h2>
                  <PromptBlock label="Session summary">
                    {session.summary ?? session.tutor_message ?? "Well done."}
                  </PromptBlock>
                  <Link
                    to="/mastery"
                    className="inline-block border border-on-surface bg-on-surface px-6 py-3 font-mono text-xs font-bold uppercase tracking-widest text-surface hover:border-secondary hover:bg-transparent hover:text-secondary"
                  >
                    View progress
                  </Link>
                </div>
              ) : (
                <>
                  {session.tutor_message && (
                    <PromptBlock>{session.tutor_message}</PromptBlock>
                  )}
                  {session.last_evaluation && (
                    <EvaluationPanel evaluation={session.last_evaluation} />
                  )}
                </>
              )}
            </div>
          )}
        </section>

        {session && !session.done && session.waiting_for_answer && (
          <footer className="sticky bottom-0 z-30 border-t border-outline-variant bg-surface">
            <form
              onSubmit={onSubmit}
              className="group mx-auto max-w-reading px-6 py-8"
            >
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={submitting}
                rows={4}
                placeholder="think before you type…"
                className="w-full resize-none border-0 border-b border-outline-variant bg-transparent font-mono text-[15px] text-on-surface placeholder:text-on-surface-variant/40 focus:border-secondary focus:ring-0 focus:outline-none"
              />
              <div className="mt-4 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                  ⌘ + Enter to submit
                </span>
                <button
                  type="submit"
                  disabled={submitting || !answer.trim()}
                  className="border border-on-surface bg-on-surface px-6 py-2 font-mono text-xs font-bold uppercase tracking-widest text-surface transition-opacity hover:border-secondary hover:bg-transparent hover:text-secondary disabled:opacity-40"
                >
                  {submitting ? "Synthesizing…" : "Synthesize"}
                </button>
              </div>
            </form>
          </footer>
        )}
      </div>
    </Layout>
  );
}
