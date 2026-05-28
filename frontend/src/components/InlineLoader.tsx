import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function InlineLoader({
  label = "Loading",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2 text-xs text-on-muted/55", className)}>
      <Loader2 className="size-3.5 animate-spin text-accent/80" />
      <span className="font-medium tracking-tight">{label}…</span>
    </div>
  );
}

