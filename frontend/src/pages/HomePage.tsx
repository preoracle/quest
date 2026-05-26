import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { ArrowRight, Brain, Layers, Timer } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { HeroDemoCard } from "@/components/HeroDemoCard";
import { Preloader } from "@/components/Preloader";
import { SignInModalTrigger } from "@/components/SignInModalTrigger";
import { SiteNav } from "@/components/SiteNav";
import { Button } from "@/components/ui/button";
import { useLenis } from "@/hooks/useLenis";
import { fetchDue } from "@/api/client";

const STEPS = [
  {
    n: "01",
    title: "Choose what to own",
    body: "Pick a topic. Quest builds the concept graph — prerequisites, dependencies, edge cases — and tracks each node as you master it.",
  },
  {
    n: "02",
    title: "Reconstruct it from scratch",
    body: "No hints. No options. Write your reasoning and the tutor probes until your answer holds under pressure.",
  },
  {
    n: "03",
    title: "Get a real diagnosis",
    body: "A separate AI scores your thinking 1–5 and names the exact gap. Not 'correct' or 'wrong' — a precise signal on what failed.",
  },
] as const;

const FEATURES = [
  {
    icon: Brain,
    title: "Socratic engine",
    body: "It never gives answers. It surfaces the next question until your reasoning is watertight — then hands off to the evaluator.",
  },
  {
    icon: Layers,
    title: "Dual-AI scoring",
    body: "Tutor and evaluator are separate. You can't charm the tutor into a high score — the evaluator is an independent judge.",
  },
  {
    icon: Timer,
    title: "SM-2 spaced repetition",
    body: "Each concept resurfaces on the exact day you'd start to lose it. Five-minute reviews build retention that lasts years.",
  },
] as const;

const CONTRASTS = [
  { left: "Reading feels like learning.", right: "Quest makes you prove it." },
  { left: "Chatbots give you the answer.", right: "Quest makes you find it." },
  { left: "Flashcards test recall.", right: "Quest tests understanding." },
  {
    left: "Anki has no feedback loop.",
    right: "Quest scores every answer 1–5.",
  },
] as const;

export function HomePage() {
  const reduce = useReducedMotion();
  const [ready, setReady] = useState(!!reduce);
  const [dueCount, setDueCount] = useState(0);
  const { user } = useAuth();

  useLenis(ready);

  useEffect(() => {
    if (!user) return;
    fetchDue()
      .then((d) => setDueCount(d.items.length))
      .catch(() => setDueCount(0));
  }, [user]);

  return (
    <>
      <AnimatePresence mode="wait">
        {!ready && <Preloader key="loader" onDone={() => setReady(true)} />}
      </AnimatePresence>

      {ready && (
        <div className="noise-overlay mesh-bg min-h-dvh">
          <SiteNav />

          {/* ── HERO ── */}
          <section className="relative flex min-h-dvh flex-col justify-center overflow-hidden px-gutter-app pt-28 pb-16">
            {/* Background glows */}
            <div
              className="pointer-events-none absolute -top-40 left-1/4 size-[700px] -translate-x-1/2 rounded-full bg-accent/8 blur-[140px]"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute top-1/2 right-0 size-[400px] -translate-y-1/2 rounded-full bg-indigo-500/5 blur-[120px]"
              aria-hidden
            />

            <div className="relative mx-auto grid w-full max-w-5xl items-center gap-16 lg:grid-cols-2">
              {/* Left: copy */}
              <div>
                <motion.div
                  className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent-dim px-4 py-1.5 text-xs font-medium text-accent"
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <span className="size-1.5 animate-pulse rounded-full bg-accent" />
                  Socratic learning engine
                </motion.div>

                <h1 className="text-hero font-display font-semibold text-on-surface">
                  {["Learn", "by thinking", "harder."].map((line, i) => (
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
                  className="mt-7 max-w-md text-[1.0625rem] leading-relaxed text-on-muted"
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.45 }}
                >
                  Quest forces you to reconstruct ideas from scratch — no hints,
                  no options.
                  <br />
                  <br />
                  Not a chatbot. Quest tracks mastery, scores every answer, and
                  tells you what to study next. Your mastery compounds every
                  day.
                </motion.p>

                <motion.div
                  className="mt-9 flex flex-wrap gap-3"
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.55 }}
                >
                  {user ? (
                    <>
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
                    </>
                  ) : (
                    <>
                      <SignInModalTrigger
                        label="Start learning free"
                        size="lg"
                        className="gap-2"
                      />
                      <Button asChild variant="ghost" size="lg">
                        <Link to="#how-it-works" className="text-on-muted">
                          See how it works
                        </Link>
                      </Button>
                    </>
                  )}
                </motion.div>
              </div>

              {/* Right: live demo card */}
              <motion.div
                className="flex justify-center lg:justify-end"
                initial={reduce ? false : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.65,
                  duration: 0.7,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <HeroDemoCard />
              </motion.div>
            </div>
          </section>

          {/* ── HOW IT WORKS ── */}
          <section
            id="how-it-works"
            className="border-y border-line/50 bg-canvas/60 px-gutter-app py-20"
          >
            <div className="mx-auto max-w-5xl">
              <motion.p
                className="mb-12 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent/80"
                initial={reduce ? false : { opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
              >
                How it works
              </motion.p>

              <div className="grid gap-10 md:grid-cols-3">
                {STEPS.map(({ n, title, body }, i) => (
                  <motion.div
                    key={n}
                    className="relative"
                    initial={reduce ? false : { opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                  >
                    {/* Connecting line (not after last) */}
                    {i < STEPS.length - 1 && (
                      <div className="absolute top-4 left-full hidden w-10 border-t border-dashed border-line/60 md:block" />
                    )}
                    <span className="font-display text-4xl font-bold text-accent/20">
                      {n}
                    </span>
                    <h3 className="mt-3 font-display text-lg font-semibold text-on-surface">
                      {title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-on-muted">
                      {body}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* ── THE PROBLEM ── */}
          <section className="px-gutter-app py-24">
            <div className="mx-auto max-w-5xl">
              <div className="grid gap-16 lg:grid-cols-2 lg:items-start">
                <div>
                  <motion.p
                    className="mb-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent/80"
                    initial={reduce ? false : { opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                  >
                    The problem
                  </motion.p>
                  <motion.h2
                    className="font-display text-3xl font-semibold leading-tight text-on-surface"
                    initial={reduce ? false : { opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                  >
                    Passive study feels
                    <br />
                    like progress.
                    <br />
                    <span className="text-on-muted">It isn&apos;t.</span>
                  </motion.h2>
                  <motion.p
                    className="mt-5 text-[1rem] leading-relaxed text-on-muted"
                    initial={reduce ? false : { opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 }}
                  >
                    Reading a chapter, re-watching a video, asking an AI to
                    explain it — all of these create the{" "}
                    <em className="text-on-surface not-italic">
                      illusion of understanding
                    </em>
                    . The real test is whether you can reconstruct the idea on
                    your own, under pressure, with nothing to copy.
                  </motion.p>
                  <motion.p
                    className="mt-4 text-[1rem] leading-relaxed text-on-muted"
                    initial={reduce ? false : { opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.15 }}
                  >
                    Quest is that test — on every concept, every time.
                  </motion.p>
                </div>

                <div className="space-y-3">
                  {CONTRASTS.map(({ left, right }, i) => (
                    <motion.div
                      key={left}
                      className="grid grid-cols-2 gap-3"
                      initial={reduce ? false : { opacity: 0, x: 16 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, margin: "-40px" }}
                      transition={{ delay: i * 0.07 }}
                    >
                      <div className="rounded-xl border border-line/40 bg-surface/20 px-4 py-3">
                        <p className="text-sm leading-relaxed text-on-muted line-through decoration-line/60">
                          {left}
                        </p>
                      </div>
                      <div className="rounded-xl border border-accent/20 bg-accent-dim/20 px-4 py-3">
                        <p className="text-sm leading-relaxed text-on-surface">
                          {right}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── FEATURE CARDS ── */}
          <section className="border-t border-line/40 bg-canvas/40 px-gutter-app py-20">
            <div className="mx-auto max-w-5xl">
              <motion.p
                className="mb-10 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent/80"
                initial={reduce ? false : { opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
              >
                Under the hood
              </motion.p>
              <div className="grid gap-5 md:grid-cols-3">
                {FEATURES.map(({ icon: Icon, title, body }, i) => (
                  <motion.article
                    key={title}
                    className="card card-hover p-6"
                    initial={reduce ? false : { opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ delay: i * 0.07 }}
                  >
                    <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                      <Icon className="size-5" strokeWidth={1.5} />
                    </div>
                    <h2 className="font-display text-lg font-semibold text-on-surface">
                      {title}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-on-muted">
                      {body}
                    </p>
                  </motion.article>
                ))}
              </div>
            </div>
          </section>

          {/* ── CLOSING CTA ── */}
          <section className="px-gutter-app py-28">
            <div className="mx-auto max-w-5xl text-center">
              <motion.div
                className="pointer-events-none absolute inset-0 -z-10 mx-auto max-w-lg rounded-full bg-accent/6 blur-3xl"
                aria-hidden
              />
              <motion.h2
                className="font-display text-4xl font-semibold text-on-surface sm:text-5xl"
                initial={reduce ? false : { opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              >
                Ready to actually
                <br />
                <span className="text-accent">understand</span> this?
              </motion.h2>
              <motion.p
                className="mx-auto mt-5 max-w-sm text-[1rem] leading-relaxed text-on-muted"
                initial={reduce ? false : { opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.15 }}
              >
                No flashcards. No tutorials. Just questions that force you to
                think — and scores that tell you the truth.
              </motion.p>
              <motion.div
                className="mt-9 flex flex-wrap justify-center gap-4"
                initial={reduce ? false : { opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.25 }}
              >
                {user ? (
                  <Button asChild size="lg">
                    <Link to="/topics">
                      Go to topics
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                ) : (
                  <SignInModalTrigger
                    label="Start learning free"
                    size="lg"
                    className="gap-2"
                  />
                )}
              </motion.div>
            </div>
          </section>

          {/* ── FOOTER ── */}
          <footer className="border-t border-line/40 px-gutter-app py-8">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
              <p className="font-display text-sm font-semibold text-on-surface">
                Quest
              </p>
              <p className="text-xs text-on-muted/50">
                Built with SM-2 · Powered by Claude
              </p>
            </div>
          </footer>
        </div>
      )}
    </>
  );
}
