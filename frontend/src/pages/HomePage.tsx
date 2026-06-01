import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { ArrowRight, Brain, Layers, Timer } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { HeroDemoCard } from "@/components/HeroDemoCard";
import { LandingFaq } from "@/components/LandingFaq";
import { LearningScenarios } from "@/components/LearningScenarios";
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
  { left: "Anki has no feedback loop.", right: "Quest scores every answer 1–5." },
] as const;

export function HomePage() {
  const reduce = useReducedMotion();
  const [ready, setReady] = useState(!!reduce);
  const [dueCount, setDueCount] = useState(0);
  const { user } = useAuth();

  useLenis(ready);

  const scrollToHowItWorks = () => {
    const el = document.getElementById("how-it-works");
    if (!el) return;
    const top = window.scrollY + el.getBoundingClientRect().top - 96;
    window.history.replaceState(null, "", "#how-it-works");
    window.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
  };

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
          <section className="relative flex min-h-dvh flex-col justify-center overflow-hidden px-gutter-app pt-28 pb-20">
            {/* Glows */}
            <div
              className="pointer-events-none absolute -top-32 left-1/3 size-[600px] -translate-x-1/2 rounded-full bg-accent/7 blur-[130px]"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute bottom-0 right-0 size-[360px] rounded-full bg-accent/4 blur-[100px]"
              aria-hidden
            />

            <div className="relative mx-auto grid w-full max-w-4xl items-center gap-14 lg:grid-cols-[1fr_auto]">
              {/* Left: copy */}
              <div className="max-w-[30rem]">
                <motion.div
                  className="mb-7 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-dim px-3.5 py-1.5 text-[11px] font-medium text-accent"
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <span className="size-1.5 animate-pulse rounded-full bg-accent" />
                  Socratic learning engine
                </motion.div>

                <h1 className="font-display text-[clamp(2.6rem,6.5vw,4.25rem)] font-semibold leading-[1.03] tracking-[-0.02em] text-on-surface">
                  {(["Learn by", "thinking", "harder."] as const).map((line, i) => (
                    <motion.span
                      key={line}
                      className={`block ${i > 0 ? "italic text-accent" : ""}`}
                      initial={reduce ? false : { opacity: 0, y: 28 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        delay: 0.08 + i * 0.11,
                        duration: 0.65,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    >
                      {line}
                    </motion.span>
                  ))}
                </h1>

                <motion.p
                  className="mt-7 text-[1rem] leading-[1.75] text-on-muted"
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.42 }}
                >
                  Quest forces you to reconstruct ideas from scratch — no hints,
                  no options. A separate AI scores every answer and tells you
                  exactly what failed. Your mastery compounds every day.
                </motion.p>

                <motion.div
                  className="mt-8 flex flex-wrap gap-3"
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.54 }}
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
                        className="gap-2 transition-all duration-300 hover:-translate-y-0.5"
                      />
                      <Button
                        variant="ghost"
                        size="lg"
                        className="group text-on-muted transition-all duration-300 hover:-translate-y-0.5 hover:text-on-surface"
                        onClick={scrollToHowItWorks}
                      >
                        See how it works
                        <span className="ml-1 inline-block transition-transform duration-300 group-hover:translate-x-1">
                          →
                        </span>
                      </Button>
                    </>
                  )}
                </motion.div>
              </div>

              {/* Right: static session mockup */}
              <motion.div
                className="flex justify-center lg:justify-end"
                initial={reduce ? false : { opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.62, duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
              >
                <HeroDemoCard />
              </motion.div>
            </div>
          </section>

          {/* ── HOW IT WORKS ── */}
          <section
            id="how-it-works"
            className="border-y border-line/40 bg-canvas/60 px-gutter-app py-24"
          >
            <div className="mx-auto max-w-3xl">
              <motion.p
                className="mb-14 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent/70"
                initial={reduce ? false : { opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
              >
                How it works
              </motion.p>

              <div className="flex flex-col divide-y divide-line/30 md:flex-row md:divide-x md:divide-y-0">
                {STEPS.map(({ n, title, body }, i) => (
                  <motion.div
                    key={n}
                    className="flex flex-col gap-3 py-8 first:pt-0 last:pb-0 md:flex-1 md:py-0 md:pr-10 md:pl-10 md:first:pl-0 md:last:pr-0"
                    initial={reduce ? false : { opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                  >
                    <span className="font-display text-5xl font-semibold italic leading-none text-accent/15">
                      {n}
                    </span>
                    <h3 className="font-display text-[1.05rem] font-semibold text-on-surface">
                      {title}
                    </h3>
                    <p className="text-[13.5px] leading-relaxed text-on-muted">{body}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* ── LEARNING SCENARIOS (interactive demo) ── */}
          <LearningScenarios />

          {/* ── THE PROBLEM ── */}
          <section className="px-gutter-app py-28">
            <div className="mx-auto max-w-3xl">
              <div className="grid gap-14 lg:grid-cols-[1fr_1.1fr] lg:items-start">
                <div>
                  <motion.p
                    className="mb-5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent/70"
                    initial={reduce ? false : { opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                  >
                    The problem
                  </motion.p>
                  <motion.h2
                    className="font-display text-[1.9rem] font-semibold leading-[1.15] text-on-surface"
                    initial={reduce ? false : { opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                  >
                    Passive study feels like progress.{" "}
                    <span className="italic text-on-muted">It isn&apos;t.</span>
                  </motion.h2>
                  <motion.p
                    className="mt-5 text-[0.9375rem] leading-relaxed text-on-muted"
                    initial={reduce ? false : { opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 }}
                  >
                    Reading, re-watching, asking AI to explain — all create the{" "}
                    <em className="not-italic text-on-surface">illusion of understanding</em>. The real test is whether you can reconstruct the idea on your own, under pressure, with nothing to copy.
                  </motion.p>
                  <motion.p
                    className="mt-3 text-[0.9375rem] leading-relaxed text-on-muted"
                    initial={reduce ? false : { opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.15 }}
                  >
                    Quest is that test — on every concept, every time.
                  </motion.p>
                </div>

                <div className="space-y-2.5">
                  {CONTRASTS.map(({ left, right }, i) => (
                    <motion.div
                      key={left}
                      className="grid grid-cols-2 gap-2.5"
                      initial={reduce ? false : { opacity: 0, x: 12 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, margin: "-40px" }}
                      transition={{ delay: i * 0.07 }}
                    >
                      <div className="rounded-lg border border-line/30 bg-surface/30 px-3.5 py-3">
                        <p className="text-[12.5px] leading-relaxed text-on-muted/60 line-through decoration-line/50">
                          {left}
                        </p>
                      </div>
                      <div className="rounded-lg border border-accent/15 bg-accent-dim/15 px-3.5 py-3">
                        <p className="text-[12.5px] leading-relaxed text-on-surface">
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
          <section className="border-t border-line/30 bg-canvas/50 px-gutter-app py-24">
            <div className="mx-auto max-w-3xl">
              <motion.p
                className="mb-10 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent/70"
                initial={reduce ? false : { opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
              >
                Under the hood
              </motion.p>
              <div className="grid gap-4 sm:grid-cols-3">
                {FEATURES.map(({ icon: Icon, title, body }, i) => (
                  <motion.article
                    key={title}
                    className="card card-hover p-5"
                    initial={reduce ? false : { opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ delay: i * 0.08 }}
                  >
                    <div className="mb-4 flex size-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
                      <Icon className="size-4" strokeWidth={1.5} />
                    </div>
                    <h2 className="font-display text-[1rem] font-semibold text-on-surface">
                      {title}
                    </h2>
                    <p className="mt-2 text-[13px] leading-relaxed text-on-muted">
                      {body}
                    </p>
                  </motion.article>
                ))}
              </div>
            </div>
          </section>

          {/* ── FAQ ── */}
          <LandingFaq />

          {/* ── CLOSING CTA ── */}
          <section className="px-gutter-app py-28">
            <div className="relative mx-auto max-w-3xl text-center">
              <div
                className="pointer-events-none absolute inset-0 -z-10 mx-auto max-w-xs rounded-full bg-accent/6 blur-3xl"
                aria-hidden
              />
              <motion.h2
                className="font-display text-[2rem] font-semibold leading-tight text-on-surface sm:text-[2.5rem]"
                initial={reduce ? false : { opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              >
                Ready to actually{" "}
                <em className="italic text-accent">understand</em> this?
              </motion.h2>
              <motion.p
                className="mx-auto mt-4 max-w-xs text-[0.9375rem] leading-relaxed text-on-muted"
                initial={reduce ? false : { opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.15 }}
              >
                No flashcards. No tutorials. Just questions that force you to
                think — and scores that tell you the truth.
              </motion.p>
              <motion.div
                className="mt-8 flex flex-wrap justify-center gap-4"
                initial={reduce ? false : { opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.25 }}
              >
                {user ? (
                  <Button asChild size="lg">
                    <Link to="/topics">
                      Open library
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                ) : (
                  <SignInModalTrigger
                    label="Start learning free"
                    size="lg"
                    className="gap-2 transition-all duration-300 hover:-translate-y-0.5"
                  />
                )}
              </motion.div>
            </div>
          </section>

          {/* ── FOOTER ── */}
          <footer className="border-t border-line/30 px-gutter-app py-8">
            <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
              <p className="font-display text-sm font-semibold italic text-on-surface">
                Quest
              </p>
              <p className="font-mono text-[11px] text-on-muted/40">
                Built with SM-2 · Powered by Claude
              </p>
            </div>
          </footer>
        </div>
      )}
    </>
  );
}
