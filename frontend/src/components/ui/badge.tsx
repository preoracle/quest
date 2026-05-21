import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2 py-0.5 font-mono text-xs font-medium tabular-nums",
  {
    variants: {
      variant: {
        default: "bg-surface-muted text-on-muted",
        good: "bg-score-good/15 text-score-good ring-1 ring-score-good/30",
        mid: "bg-accent-dim text-accent ring-1 ring-accent/25",
        low: "bg-score-low/15 text-score-low ring-1 ring-score-low/30",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
