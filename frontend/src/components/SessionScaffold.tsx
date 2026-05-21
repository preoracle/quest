import { useEffect, useRef, type ReactNode } from "react";
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
}: {
  pinnedQuestion?: ReactNode;
  scroll: ReactNode;
  pinnedBottom?: ReactNode;
  className?: string;
  turnsAnswered?: number;
  /** Change this value to scroll history to bottom (e.g. pass turnSeed). */
  scrollTrigger?: string | number;
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
      {pct !== undefined && (
        <div className="h-[2px] w-full shrink-0 bg-surface-muted">
          <div
            className="h-full rounded-full bg-accent/50 transition-all duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
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

      {/* Bottom zone: current question + answer bar share one border-top */}
      {(pinnedQuestion || pinnedBottom) && (
        <div className="shrink-0 border-t border-line/30 bg-void/85 backdrop-blur-xl">
          {pinnedQuestion && (
            <div className={cn("py-3", gutterPx)}>
              <ContentTrack tier="reading">{pinnedQuestion}</ContentTrack>
            </div>
          )}
          {pinnedBottom && <div>{pinnedBottom}</div>}
        </div>
      )}
    </div>
  );
}
