import { motion, useReducedMotion } from "framer-motion";

/** Active Socratic question — visually distinct as current tutor ask. */
export function QuestionHero({
  question,
  focus,
}: {
  question: string;
  focus?: string | null;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.article
      key={question}
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-start gap-3"
    >
      {/* Tutor avatar */}
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-accent/15 ring-1 ring-accent/25">
        <span className="text-[10px] font-bold text-accent">T</span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-accent/70">
          Tutor{focus ? ` · ${focus}` : ""}
        </p>
        <p className="text-[15px] leading-relaxed text-on-surface">
          {question}
        </p>
      </div>
    </motion.article>
  );
}
