import { useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ContentTrack } from "@/components/ContentColumn";
import { gutterPx, pagePy } from "@/lib/layout";
import { cn } from "@/lib/utils";

const EXPECTED_TURNS = 8;

/**
 * Study session: scrollable history on top, pinned question + answer bar at bottom.
 * Conversation reads naturally top→bottom.
 */
export function SessionScaffold({
  pinnedQuestion,
  scroll,
  pinnedBottom,
  className,
  turnsAnswered,
  scrollTrigger,
  streak,
}: {
  pinnedQuestion?: ReactNode;
  scroll: ReactNode;
  pinnedBottom?: ReactNode;
  className?: string;
  turnsAnswered?: number;
  /** Change this value to scroll history to bottom (e.g. pass turnSeed). */
  scrollTrigger?: string | number;
  streak?: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const pct =
    turnsAnswered !== undefined
      ? Math.min((turnsAnswered / EXPECTED_TURNS) * 100, 95)
      : undefined;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [scrollTrigger]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}>
      {/* Progress bar + streak pill */}
      {pct !== undefined && (
        <div className="relative shrink-0">
          <div className="h-[2px] w-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-accent/50 transition-all duration-700 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <AnimatePresence>
            {streak !== undefined && streak >= 2 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.75, x: 6 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.75 }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
                className="absolute right-4 top-1 flex items-center gap-1 rounded-full border border-accent/25 bg-accent-dim/60 px-2 py-0.5 text-[10px] font-semibold text-accent shadow-sm"
              >
                🔥 {streak}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Scrollable history */}
      <div
        ref={scrollRef}
        className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", gutterPx)}
      >
        <ContentTrack tier="reading" className={cn(pagePy, "pb-4 pt-6")}>
          {scroll}
        </ContentTrack>
      </div>

      {/* Bottom zone: question prompt above, answer composer below */}
      {(pinnedQuestion || pinnedBottom) && (
        <div className="shrink-0 border-t border-line/40 bg-void/90 backdrop-blur-xl">
          {pinnedQuestion && (
            <div className={cn("border-b border-line/20 pb-3.5 pt-3.5", gutterPx)}>
              <ContentTrack tier="reading">{pinnedQuestion}</ContentTrack>
            </div>
          )}
          {pinnedBottom && pinnedBottom}
        </div>
      )}
    </div>
  );
}
