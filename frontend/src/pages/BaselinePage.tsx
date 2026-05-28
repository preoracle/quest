import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ScanLine } from "lucide-react";
import { toast } from "sonner";
import {
  startBaseline,
  startSession,
  submitBaselineAnswer,
} from "@/api/client";
import type { BaselineView } from "@/api/types";
import { AppShell } from "@/components/AppShell";
import { InlineLoader } from "@/components/InlineLoader";
import { PageScaffold } from "@/components/PageScaffold";
import { Button } from "@/components/ui/button";
import { sectionGap } from "@/lib/layout";
import { cn } from "@/lib/utils";

export function BaselinePage() {
  const { topicId } = useParams<{ topicId: string }>();
  const navigate = useNavigate();
  const [view, setView] = useState<BaselineView | null>(null);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [started, setStarted] = useState(false);

  const load = useCallback(async () => {
    if (!topicId) return;
    try {
      const v = await startBaseline(topicId);
      setView(v);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start baseline");
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

  async function goToStudy() {
    if (!topicId) return;
    let session = await startSession(topicId, "study");
    if (session.done) {
      session = await startSession(topicId, "replay");
    }
    navigate(`/session/${session.session_id}`);
  }

  async function onSubmit() {
    if (!view || !answer.trim() || submitting) return;
    setSubmitting(true);
    try {
      const next = await submitBaselineAnswer(view.session_id, answer.trim());
      setView(next);
      setAnswer("");
      if (next.done) {
        await goToStudy();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell
      breadcrumb={[
        { label: "Library", to: "/topics" },
        ...(topicId
          ? [{ label: view?.topic_display ?? topicId, to: `/topics/${topicId}` }]
          : []),
        { label: "Baseline check" },
      ]}
    >
      <PageScaffold tier="reading">
        <div className={cn("flex flex-col", sectionGap)}>

          {/* Framing screen — shown before calibration starts */}
          {!started && !loading && view && !view.done && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-6"
            >
              <div className="flex size-12 items-center justify-center rounded-xl bg-accent-dim">
                <ScanLine className="size-5 text-accent" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-semibold text-on-surface">
                  Baseline check
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-on-muted">
                  Before we begin, let's see what you already know about{" "}
                  <span className="font-medium text-on-surface">
                    {view.topic_display}
                  </span>
                  . Answer as best you can — there's no penalty for gaps. This
                  takes about 5 questions and helps the tutor skip what you've
                  already mastered.
                </p>
              </div>
              <div className="flex items-center gap-4 rounded-xl border border-line/40 bg-surface/20 px-4 py-3 text-sm text-on-muted">
                <span className="font-mono text-accent">{view.total}</span>
                <span>concepts to calibrate</span>
                <span className="ml-auto text-xs">~5 min</span>
              </div>
              <div className="flex gap-3">
                <Button onClick={() => setStarted(true)}>
                  Start baseline
                </Button>
                <Button asChild variant="ghost">
                  <Link to="/topics">Back to library</Link>
                </Button>
              </div>
            </motion.div>
          )}

          {loading && <InlineLoader label="Preparing baseline" />}

          {started && view && !view.done && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col gap-5"
            >
              <div className="flex items-center gap-3">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${((view.step - 1) / view.total) * 100}%` }}
                  />
                </div>
                <span className="shrink-0 font-mono text-xs text-on-muted">
                  {view.step} / {view.total}
                </span>
              </div>
              {view.concept_name && (
                <p className="font-mono text-xs text-accent">{view.concept_name}</p>
              )}
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
                autoFocus
              />
              <div className="flex gap-3">
                <Button
                  disabled={submitting || !answer.trim()}
                  onClick={() => void onSubmit()}
                >
                  {submitting ? "Submitting…" : "Submit"}
                </Button>
                <Button asChild variant="ghost">
                  <Link to="/topics">Back to library</Link>
                </Button>
              </div>
            </motion.div>
          )}

          {view?.done && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-5"
            >
              <div>
                <p className="font-display text-lg font-semibold text-score-good">
                  Baseline complete
                </p>
                <p className="mt-1 text-sm text-on-muted">
                  Study sessions will now adapt to your current level.
                </p>
              </div>
              <ul className="card divide-y divide-line">
                {view.results.map((r) => (
                  <li
                    key={r.concept_id}
                    className="flex justify-between px-4 py-3 text-sm"
                  >
                    <span>{r.name}</span>
                    <span className="font-mono tabular-nums text-on-muted">
                      {r.score}/5
                    </span>
                  </li>
                ))}
              </ul>
              <Button onClick={() => void goToStudy()}>Enter focus</Button>
            </motion.div>
          )}

        </div>
      </PageScaffold>
    </AppShell>
  );
}
