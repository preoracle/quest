import { QuestLogo } from "@/components/QuestLogo";
import { cn } from "@/lib/utils";

function Rail({ className }: { className?: string }) {
  return (
    <div className={cn("h-1 w-44 overflow-hidden rounded-full bg-line/70", className)}>
      <div className="h-full w-1/2 animate-[quest-rail_1.15s_cubic-bezier(0.23,1,0.32,1)_infinite] rounded-full bg-accent" />
    </div>
  );
}

export function PageLoader({
  label = "Loading",
  hint,
  className,
}: {
  label?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-[60vh] items-center justify-center px-6", className)}>
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <QuestLogo size="lg" />
          <p className="mt-5 text-sm font-medium text-on-surface/85">{label}</p>
          {hint && <p className="mt-1 text-xs text-on-muted/60">{hint}</p>}
          <Rail className="mt-6" />
        </div>

        {/* subtle skeleton frame so it feels “designed” */}
        <div className="mt-8 grid gap-3">
          <div className="rounded-xl border border-line/25 bg-surface/12 p-4">
            <div className="skeleton mb-3 h-3 w-24" />
            <div className="skeleton mb-2 h-5 w-3/4" />
            <div className="skeleton h-3 w-2/5" />
          </div>
          <div className="rounded-xl border border-line/25 bg-surface/12 p-4">
            <div className="skeleton mb-2 h-3 w-20" />
            <div className="skeleton h-3 w-1/2" />
          </div>
        </div>
      </div>
    </div>
  );
}

