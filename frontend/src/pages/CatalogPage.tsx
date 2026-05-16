import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchTopics, startSession } from "../api/client";
import type { Topic } from "../api/types";
import { Layout } from "../components/Layout";

export function CatalogPage() {
  const navigate = useNavigate();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    fetchTopics()
      .then(setTopics)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  async function begin(topicId: string, resume: boolean) {
    setStarting(topicId);
    setError(null);
    try {
      const session = await startSession(topicId, resume);
      navigate(`/session/${session.session_id}`, {
        state: { session, topicId },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start session");
    } finally {
      setStarting(null);
    }
  }

  return (
    <Layout>
      <section className="mx-auto max-w-[1140px] px-6 py-16 md:px-16">
        <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
          Catalog of Inquiries
        </h1>
        <p className="mt-6 max-w-reading text-lg leading-relaxed text-on-surface-variant">
          Choose a line of inquiry. The tutor asks; you think. No answers are
          given—only better questions.
        </p>

        {error && (
          <p className="mt-8 border border-outline-variant px-4 py-3 font-mono text-sm text-on-surface-variant">
            {error}
          </p>
        )}

        {loading && (
          <p className="mt-12 font-mono text-sm uppercase tracking-widest text-on-surface-variant">
            Loading…
          </p>
        )}

        <ul className="mt-16 grid gap-6 md:grid-cols-2">
          {topics.map((t) => (
            <li
              key={t.id}
              className="border border-outline-variant bg-surface-container-low p-8 transition-colors hover:border-secondary"
            >
              <h2 className="font-display text-2xl font-semibold">{t.display_name}</h2>
              <p className="mt-2 font-mono text-xs uppercase tracking-widest text-on-surface-variant">
                {t.id}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={!!starting}
                  onClick={() => begin(t.id, false)}
                  className="border border-on-surface bg-on-surface px-6 py-3 font-mono text-xs font-bold uppercase tracking-widest text-surface transition-colors hover:border-secondary hover:bg-transparent hover:text-secondary disabled:opacity-50"
                >
                  {starting === t.id ? "Starting…" : "New inquiry"}
                </button>
                <button
                  type="button"
                  disabled={!!starting}
                  onClick={() => begin(t.id, true)}
                  className="border border-outline-variant px-6 py-3 font-mono text-xs font-bold uppercase tracking-widest text-on-surface transition-colors hover:border-secondary hover:text-secondary disabled:opacity-50"
                >
                  Resume
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </Layout>
  );
}
