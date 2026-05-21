import { motion, useReducedMotion } from "framer-motion";
import { MessageCircleQuestion } from "lucide-react";

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
      className="question-card"
      key={question}
      initial={reduce ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="mb-6 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-accent/10 text-accent ring-1 ring-accent/20">
          <MessageCircleQuestion className="size-5" strokeWidth={1.75} />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">
            Your question
          </p>
          {focus && (
            <p className="mt-0.5 font-mono text-xs text-on-muted">{focus}</p>
          )}
        </div>
      </div>
      <p className="font-mono text-lg leading-[1.65] text-on-surface md:text-[1.35rem]">
        {question}
      </p>
    </motion.article>
  );
}
