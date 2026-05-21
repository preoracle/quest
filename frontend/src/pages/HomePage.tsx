import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Brain,
  Layers,
  Sparkles,
  Timer,
} from "lucide-react";
import { Preloader } from "@/components/Preloader";
import { SiteNav } from "@/components/SiteNav";
import { Button } from "@/components/ui/button";
import { useLenis } from "@/hooks/useLenis";
import { fetchDue } from "@/api/client";

const HERO_LINES = ["Learn", "by thinking", "harder."];

const STEPS = [
  { n: "01", title: "Pick a topic", body: "Closures, RAG, binary search — structured concept maps." },
  { n: "02", title: "Answer questions", body: "The tutor only asks. It never explains or gives away answers." },
  { n: "03", title: "Get scored", body: "A separate model rates you 1–5 and shows exactly what you missed." },
] as const;

const FEATURES = [
  {
    icon: Brain,
    title: "Socratic tutor",
    body: "Forces real reasoning — not passive reading.",
  },
  {
    icon: Layers,
    title: "Dual AI roles",
    body: "Tutor asks. Evaluator grades. Never the same voice.",
  },
  {
    icon: Timer,
    title: "SM-2 scheduling",
    body: "Reviews what you're about to forget.",
  },
] as const;

export function HomePage() {
  const reduce = useReducedMotion();
  const [ready, setReady] = useState(!!reduce);
  const [dueCount, setDueCount] = useState(0);

  useLenis(ready);

  useEffect(() => {
    fetchDue()
      .then((d) => setDueCount(d.items.length))
      .catch(() => setDueCount(0));
  }, []);

  return (
    <>
      <AnimatePresence mode="wait">
        {!ready && <Preloader key="loader" onDone={() => setReady(true)} />}
      </AnimatePresence>

      {ready && (
        <div className="noise-overlay mesh-bg min-h-screen">
          <SiteNav />

          <section className="relative flex min-h-[100dvh] flex-col justify-center overflow-hidden px-6 pt-28 pb-24">
            <div
              className="pointer-events-none absolute -top-32 left-1/2 size-[600px] -translate-x-1/2 rounded-full bg-accent/10 blur-[120px]"
              aria-hidden
            />
            <div className="relative mx-auto w-full max-w-5xl">
              <motion.div
                className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent-dim px-4 py-1.5 text-xs font-medium text-accent"
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Sparkles className="size-3.5" />
                Socratic learning engine
              </motion.div>

              <h1 className="text-hero font-display font-semibold text-on-surface">
                {HERO_LINES.map((line, i) => (
                  <motion.span
                    key={line}
                    className="block"
                    initial={reduce ? false : { opacity: 0, y: 32 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: 0.1 + i * 0.12,
                      duration: 0.6,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    {line}
                  </motion.span>
                ))}
              </h1>

              <motion.p
                className="mt-8 max-w-lg text-lg leading-relaxed text-on-muted"
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 }}
              >
                Not a chatbot. Quest tracks mastery, scores every answer, and
                tells you what to study next.
              </motion.p>

              <motion.div
                className="mt-10 flex flex-wrap gap-4"
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.55 }}
              >
                <Button asChild size="lg">
                  <Link to="/topics">
                    Start studying
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                {dueCount > 0 && (
                  <Button asChild variant="outline" size="lg">
                    <Link to="/due">{dueCount} due for review</Link>
                  </Button>
                )}
              </motion.div>
            </div>
          </section>

          <section className="border-y border-line/60 bg-canvas/50 px-6 py-16">
            <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
              {STEPS.map(({ n, title, body }, i) => (
                <motion.div
                  key={n}
                  className="relative"
                  initial={reduce ? false : { opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                >
                  <span className="font-display text-5xl font-bold text-line">
                    {n}
                  </span>
                  <h3 className="mt-2 font-display text-lg font-semibold text-on-surface">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-on-muted">
                    {body}
                  </p>
                </motion.div>
              ))}
            </div>
          </section>

          <section className="px-6 py-20">
            <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }, i) => (
                <motion.article
                  key={title}
                  className="card p-6"
                  initial={reduce ? false : { opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ delay: i * 0.06 }}
                >
                  <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <Icon className="size-5" strokeWidth={1.5} />
                  </div>
                  <h2 className="font-display text-lg font-semibold">{title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-on-muted">
                    {body}
                  </p>
                </motion.article>
              ))}
            </div>
          </section>

          <footer className="border-t border-line/60 px-6 py-10 text-center">
            <Button asChild variant="ghost">
              <Link to="/topics">Browse all topics →</Link>
            </Button>
          </footer>
        </div>
      )}
    </>
  );
}
