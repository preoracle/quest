import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

// ── Topics list skeleton (used in TopicsPage) ─────────────────────────────
export function TopicListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-line/30 bg-surface/20 px-4 py-3">
          <div className="min-w-0 flex-1">
            <Skeleton className="mb-2 h-4 w-2/5" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-8 w-20 shrink-0 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

// ── Dashboard skeleton ────────────────────────────────────────────────────
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* Greeting row */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <Skeleton className="mb-2 h-7 w-44" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        {/* Left: recommendation card + topic list */}
        <div className="flex flex-col gap-5">
          {/* Recommendation card */}
          <div className="rounded-xl border border-line/30 bg-surface/20 p-5">
            <Skeleton className="mb-3 h-3 w-28" />
            <Skeleton className="mb-2 h-6 w-3/5" />
            <Skeleton className="mb-4 h-4 w-2/5" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-28 rounded-lg" />
              <Skeleton className="h-8 w-20 rounded-lg" />
            </div>
          </div>
          {/* Topic rows */}
          <div className="flex flex-col gap-1.5">
            <Skeleton className="mb-1 h-3 w-16" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-line/30 bg-surface/20 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <Skeleton className="mb-1.5 h-4 w-2/5" />
                  <Skeleton className="h-1.5 w-20 rounded-full" />
                </div>
                <Skeleton className="h-8 w-16 shrink-0 rounded-lg" />
              </div>
            ))}
          </div>
        </div>

        {/* Right: stats card */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-line/30 bg-surface/20 p-4">
            <Skeleton className="mb-4 h-3 w-24" />
            <div className="flex flex-col gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="size-8 shrink-0 rounded-lg" />
                  <div className="flex-1">
                    <Skeleton className="mb-1.5 h-3 w-20" />
                    <Skeleton className="h-5 w-12" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Due page skeleton ─────────────────────────────────────────────────────
export function DueSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>
      {[1, 2].map((g) => (
        <div key={g} className="rounded-xl border border-line/30 bg-surface/20 p-4">
          <div className="mb-3 flex items-center justify-between">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-line/20 bg-surface/30 px-3 py-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Session page skeleton ─────────────────────────────────────────────────
export function SessionPageSkeleton({ isFresh = false }: { isFresh?: boolean }) {
  return (
    <div className="flex flex-col gap-5">
      {/* Concept label */}
      <Skeleton className="h-2.5 w-24" />
      {/* Question lines */}
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-[90%]" />
        <Skeleton className="h-5 w-[78%]" />
      </div>
      {/* Spinner + label */}
      <div className="flex items-center gap-2 pt-1 text-xs text-on-muted/40">
        <span className="size-3 animate-spin rounded-full border border-line border-t-accent" />
        {isFresh ? "Generating your first question…" : "Loading session…"}
      </div>
      {/* Answer bar placeholder */}
      <div className="mt-2 rounded-2xl border border-line/30 bg-surface/20 px-5 py-4">
        <Skeleton className="mb-3 h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="mt-4 flex justify-end">
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// ── Evaluating skeleton (while answer is being scored) ────────────────────
export function EvaluatingSkeleton() {
  return (
    <div className="flex items-center gap-2 text-xs text-on-muted/40">
      <span className="size-3 animate-spin rounded-full border border-line border-t-accent" />
      Evaluating your answer…
    </div>
  );
}

// ── Mastery page skeleton ─────────────────────────────────────────────────
export function MasterySkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* Stat cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-line/30 bg-surface/20 px-4 py-3.5">
            <Skeleton className="mb-3 h-2.5 w-16" />
            <Skeleton className="mb-2 h-8 w-14" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
      {/* Topic cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border border-line/30 bg-surface/20 px-4 py-3.5">
            <Skeleton className="mb-2 h-5 w-3/4" />
            <Skeleton className="mb-3 h-3 w-1/2" />
            <Skeleton className="h-1 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
