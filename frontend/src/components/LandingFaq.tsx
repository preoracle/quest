import { motion, useReducedMotion } from "framer-motion";

const FAQ_ITEMS = [
  {
    id: "vs-chatgpt",
    question: "Isn't this just ChatGPT with extra steps?",
    answer:
      "No. ChatGPT gives you answers. Quest refuses to. Every response is a question that probes whether your reasoning actually holds — not a summary of what you asked. The evaluator is a separate AI that scores your thinking 1–5 and names the exact gap. ChatGPT has no memory of what you half-understand, no spaced repetition, and no way to tell you you're wrong.",
  },
  {
    id: "vs-anki",
    question: "How is this different from Anki?",
    answer:
      "Anki tests recall: do you remember the answer? Quest tests understanding: can you reconstruct the reasoning from scratch, under pressure, with nothing to copy? Anki gives you a card and asks you to flip it. Quest gives you a blank page and asks you to fill it — then an independent AI judges whether what you wrote would hold in a real interview or exam.",
  },
  {
    id: "what-subjects",
    question: "What can I study with Quest?",
    answer:
      "Anything you can describe to the AI: CS fundamentals, system design, calculus, physics, economics, history, medicine, law. You pick a topic, Quest generates the concept graph — prerequisites, dependencies, edge cases — and starts drilling. The Socratic engine works on any subject where reasoning can be probed.",
  },
  {
    id: "session-length",
    question: "How long is a session?",
    answer:
      "Usually 5–15 minutes. Each concept gets one deep exchange: the tutor questions until your reasoning holds, then the evaluator scores it. Quest then schedules your next review using SM-2 — the interval is based on how you scored. A 5/5 might not resurface for two weeks. A 2/5 comes back tomorrow.",
  },
  {
    id: "score-meaning",
    question: "What does the 1–5 score actually mean?",
    answer:
      "1 = no understanding demonstrated. 2 = fragments, major gaps. 3 = correct direction, incomplete. 4 = solid with minor imprecision. 5 = precise, complete, would hold under any follow-up. The evaluator always names what specifically failed — not just the number. It's a signal, not a grade.",
  },
  {
    id: "data-privacy",
    question: "Is my session data private?",
    answer:
      "Your answers, scores, and concept graph are yours. We don't share them or use them to train models. Sessions are stored so the SM-2 scheduler can surface reviews at the right time — that's the only reason.",
  },
] as const;

export function LandingFaq() {
  const reduce = useReducedMotion();

  return (
    <section
      id="faq"
      className="px-gutter-app py-24"
      aria-labelledby="faq-heading"
    >
      <div className="mx-auto max-w-3xl">
        <div className="mx-auto max-w-[640px]">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-12"
          >
            <p
              id="faq-heading"
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-on-muted/40"
            >
              Questions
            </p>
          </motion.div>

          <motion.div
            initial={reduce ? false : { opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="divide-y divide-line/25"
          >
            {FAQ_ITEMS.map((item, i) => (
              <motion.details
                key={item.id}
                className="group"
                initial={reduce ? false : { opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: i * 0.06, duration: 0.4 }}
              >
                <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-6 [&::-webkit-details-marker]:hidden">
                  <span className="font-display text-[1rem] font-medium italic leading-snug text-on-surface transition-colors group-open:text-accent">
                    {item.question}
                  </span>
                  <span
                    className="mt-0.5 shrink-0 select-none font-mono text-[15px] font-light leading-none text-on-muted/35 transition-colors group-open:text-accent/60"
                    aria-hidden
                  >
                    <span className="group-open:hidden">+</span>
                    <span className="hidden group-open:inline">−</span>
                  </span>
                </summary>
                <div className="pb-6 pt-0">
                  <p className="text-[13.5px] leading-[1.75] text-on-muted">
                    {item.answer}
                  </p>
                </div>
              </motion.details>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
