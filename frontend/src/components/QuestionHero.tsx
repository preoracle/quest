import { motion, useReducedMotion } from "framer-motion";
import { MessageContent } from "@/components/MessageContent";

/** Active Socratic question — pinned prompt the learner is currently answering. */
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
    >
      {/* Label row: avatar + role + live indicator */}
      <div className="mb-2.5 flex items-center gap-2">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent/15 ring-1 ring-accent/25">
          <span className="text-[11px] font-bold text-accent">T</span>
        </div>
        <span className="text-xs font-semibold uppercase tracking-wider text-accent/80">
          Tutor{focus ? ` · ${focus}` : ""}
        </span>
        <span className="size-2 animate-pulse rounded-full bg-accent/60" />
      </div>

      {/* Full-width question — the focal point */}
      <MessageContent
        text={question}
        className="text-[19px] font-medium leading-[1.65] text-on-surface"
      />
    </motion.article>
  );
}
