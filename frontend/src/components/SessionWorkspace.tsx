import { useEffect, useRef, type ReactNode } from "react";
import { ContentTrack } from "@/components/ContentColumn";
import { CycleRail } from "@/components/CycleRail";
import { gutterPx, pagePy } from "@/lib/layout";
import { cn } from "@/lib/utils";
import type { CompletedCycle } from "@/lib/cycles";

export function SessionWorkspace({
  cycles,
  expandedCycleIds,
  onToggleCycle,
  activeContent,
  pinnedBottom,
  panel,
  scrollTrigger,
  className,
}: {
  cycles: CompletedCycle[];
  expandedCycleIds: Set<string>;
  onToggleCycle: (id: string) => void;
  activeContent: ReactNode;
  pinnedBottom?: ReactNode;
  panel?: ReactNode;
  scrollTrigger?: string | number;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [scrollTrigger]);

  // Scroll to bottom on mount
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  return (
    <div className={cn("flex min-h-0 flex-1 overflow-hidden", className)}>
      {/* Left: main content column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Compressed cycle history */}
        <CycleRail
          cycles={cycles}
          expandedIds={expandedCycleIds}
          onToggle={onToggleCycle}
        />

        {/* Scrollable active zone */}
        <div
          ref={scrollRef}
          className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", gutterPx)}
        >
          <ContentTrack tier="reading" className={cn(pagePy, "pb-4 pt-6")}>
            {activeContent}
          </ContentTrack>
        </div>

        {/* Pinned bottom: answer bar */}
        {pinnedBottom && (
          <div className="shrink-0 border-t border-line/40 bg-void/90 backdrop-blur-xl">
            {pinnedBottom}
          </div>
        )}
      </div>

      {/* Right: session panel — desktop only */}
      {panel && (
        <div className="hidden w-60 shrink-0 border-l border-line/20 lg:block">
          {panel}
        </div>
      )}
    </div>
  );
}
