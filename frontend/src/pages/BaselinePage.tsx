import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import {
  startBaseline,
  startSession,
  submitBaselineAnswer,
} from "@/api/client";
import type { BaselineView } from "@/api/types";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";

export function BaselinePage() {
  const { topicId } = useParams<{ topicId: string }>();
  const navigate = useNavigate();
  const [view, setView] = useState<BaselineView | null>(null);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!topicId) return;
    setError(null);
    try {
      const v = await startBaseline(topicId);
      setView(v);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start baseline");
    } finally {
      setLoading(false);
    }
  }, [topicId]);

  useEffect(() => {
    if (!topicId) {
      navigate("/topics", { replace: true });
      return;
    }
    void load();
  }, [topicId, load, navigate]);

  async function onSubmit() {
    if (!view || !answer.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const next = await submitBaselineAnswer(view.session_id, answer.trim());
      setView(next);
      setAnswer("");
      if (next.done) {
        const session = await startSession(topicId!, "study");
        navigate(`/session/${session.session_id}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell topicLabel={view?.topic_display}>
      <div className="mx-auto max-w-[44rem] px-5 py-8 lg:px-8">
        <PageHeader
          title="Calibrate"
          description="Quick assessment (up to 5 concepts) so study skips what you already know."
        />

        {loading && <p className="text-on-muted">Loading…</p>}
        {error && <p className="text-score-low">{error}</p>}

        {view && !loading && !view.done && (
          <div className="space-y-6">
            <p className="font-mono text-xs text-accent">
              Step {view.step} of {view.total}
              {view.concept_name && ` · ${view.concept_name}`}
            </p>
            <div className="card p-6">
              <p className="font-mono text-sm leading-relaxed text-on-surface">
                {view.question}
              </p>
            </div>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={4}
              placeholder="What do you already know?"
              className="card w-full resize-none p-4 font-mono text-sm text-on-surface placeholder:text-on-muted focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            <div className="flex gap-3">
              <Button
                disabled={submitting || !answer.trim()}
                onClick={() => void onSubmit()}
              >
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Submit
              </Button>
              <Button asChild variant="ghost">
                <Link to="/topics">Skip for now</Link>
              </Button>
            </div>
          </div>
        )}

        {view?.done && (
          <div className="space-y-4">
            <p className="text-score-good font-medium">Calibration complete.</p>
            <ul className="card divide-y divide-line">
              {view.results.map((r) => (
                <li key={r.concept_id} className="flex justify-between px-4 py-3 text-sm">
                  <span>{r.name}</span>
                  <span className="font-mono tabular-nums">{r.score}/5</span>
                </li>
              ))}
            </ul>
            <Button
              onClick={() =>
                void startSession(topicId!, "study").then((s) =>
                  navigate(`/session/${s.session_id}`),
                )
              }
            >
              Start studying
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
