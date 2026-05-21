import type { ReactNode } from "react";
import { tierMaxWidth, gutterPx, pagePy, type ContentTier } from "@/lib/layout";
import { cn } from "@/lib/utils";

/**
 * Standard app page: optional fixed toolbar + single scroll region.
 * Use inside AppShell (h-dvh). Width tier: catalog | reading.
 */
export function PageScaffold({
  toolbar,
  children,
  className,
  contentClassName,
  tier = "catalog",
}: {
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  tier?: ContentTier;
}) {
  const maxW = tierMaxWidth[tier];

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      {toolbar && (
        <div
          className={cn(
            "shrink-0 border-b border-line/35",
            gutterPx,
            "py-section",
          )}
        >
          <div className={cn("mx-auto w-full", maxW)}>{toolbar}</div>
        </div>
      )}
      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain",
          contentClassName,
        )}
      >
        <div className={cn("mx-auto w-full", maxW, gutterPx, pagePy)}>
          {children}
        </div>
      </div>
    </div>
  );
}
