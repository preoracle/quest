import type { ReactNode } from "react";
import { tierMaxWidth, gutterPx, type ContentTier } from "@/lib/layout";
import { cn } from "@/lib/utils";

/** Centered max-width track only (gutter applied by parent scaffold). */
export function ContentTrack({
  tier,
  children,
  className,
}: {
  tier: ContentTier;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full", tierMaxWidth[tier], className)}>
      {children}
    </div>
  );
}

/** Track + horizontal gutter (standalone blocks). */
export function ContentColumn({
  tier,
  children,
  className,
}: {
  tier: ContentTier;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full", tierMaxWidth[tier], gutterPx, className)}>
      {children}
    </div>
  );
}
