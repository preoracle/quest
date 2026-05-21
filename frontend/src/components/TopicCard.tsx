import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  Gauge,
  Play,
  RotateCcw,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import type { StartMode } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TopicCardProps {
  id: string;
  displayName: string;
  hook: string;
  conceptCount: number;
  previewConcepts: string[];
  started: boolean;
  masteredCount: number;
  avgScore: number;
  dueCount: number;
  busy: boolean;
  expanded: boolean;
  onToggle: () => void;
  onStart: (mode: StartMode) => void;
}

export function TopicCard({
  id,
  displayName,
  hook,
  conceptCount,
  previewConcepts,
  started,
  masteredCount,
  avgScore,
  dueCount,
  busy,
  expanded,
  onToggle,
  onStart,
}: TopicCardProps) {
  const progressPct =
    conceptCount > 0 ? Math.round((masteredCount / conceptCount) * 100) : 0;

  return (
    <article
      className={cn(
        "card overflow-hidden transition-[border-color] duration-200",
        expanded && "border-accent/25",
        busy && "opacity-60",
      )}
    >
      <div className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-semibold text-on-surface">
                {displayName}
              </h2>
              {dueCount > 0 && (
                <Badge variant="low">{dueCount} due</Badge>
              )}
              {!started && (
                <Badge variant="mid">New</Badge>
              )}
            </div>

            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-on-muted">
              {hook}
            </p>

            {previewConcepts.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {previewConcepts.map((name) => (
                  <span
                    key={name}
                    className="rounded-md bg-surface-muted px-2 py-0.5 text-[11px] text-on-muted"
                  >
                    {name}
                  </span>
                ))}
                {conceptCount > previewConcepts.length && (
                  <span className="px-1 text-[11px] text-on-muted/70">
                    +{conceptCount - previewConcepts.length} more
                  </span>
                )}
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-on-muted">
              <span>{conceptCount} concepts</span>
              {started && (
                <>
                  <span>{masteredCount} mastered</span>
                  <span className="font-mono tabular-nums">
                    {avgScore.toFixed(1)}/5 avg
                  </span>
                </>
              )}
            </div>

            {started && conceptCount > 0 && (
              <div className="mt-3 h-1.5 max-w-xs overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-accent/80 transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              disabled={busy}
              onClick={() => onStart("resume")}
              className="min-w-[7.5rem]"
            >
              <Play className="size-3.5" />
              {busy ? "…" : started ? "Continue" : "Start"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              aria-expanded={expanded}
              onClick={onToggle}
            >
              More
              <ChevronDown
                className={cn(
                  "size-4 transition-transform duration-200",
                  expanded && "rotate-180",
                )}
              />
            </Button>
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-line/60 bg-surface/40"
          >
            <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
              <ActionGroup
                title="Study"
                description="Socratic sessions on this map"
                actions={[
                  {
                    label: started ? "Continue session" : "Start studying",
                    hint: "Resume where you left off",
                    icon: Play,
                    onClick: () => onStart("resume"),
                  },
                  {
                    label: "New session",
                    hint: "Fresh run; scheduler picks weak concepts",
                    icon: Sparkles,
                    onClick: () => onStart("study"),
                  },
                  {
                    label: "Fresh run",
                    hint: "Walk every concept in order again",
                    icon: RotateCcw,
                    onClick: () => onStart("replay"),
                  },
                ]}
              />
              <ActionGroup
                title="Setup & progress"
                description="Calibration and mastery view"
                actions={[
                  {
                    label: "Calibrate",
                    hint: "5 quick probes to seed baseline",
                    icon: Gauge,
                    href: `/baseline/${id}`,
                  },
                  {
                    label: "View progress",
                    hint: "Concept map and scores",
                    icon: TrendingUp,
                    href: `/mastery?topic=${encodeURIComponent(id)}`,
                  },
                ]}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}

function ActionGroup({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions: {
    label: string;
    hint: string;
    icon: typeof Play;
    onClick?: () => void;
    href?: string;
  }[];
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-on-muted">
        {title}
      </p>
      <p className="mt-0.5 text-[11px] text-on-muted/80">{description}</p>
      <ul className="mt-3 space-y-2">
        {actions.map(({ label, hint, icon: Icon, onClick, href }) => (
          <li key={label}>
            {href ? (
              <Link
                to={href}
                className="flex gap-3 rounded-lg border border-line/50 bg-surface-elevated/60 px-3 py-2.5 transition-colors hover:border-accent/30 hover:bg-surface-muted"
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-accent" />
                <span>
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-xs text-on-muted">{hint}</span>
                </span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={onClick}
                className="flex w-full gap-3 rounded-lg border border-line/50 bg-surface-elevated/60 px-3 py-2.5 text-left transition-colors hover:border-accent/30 hover:bg-surface-muted"
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-on-muted" />
                <span>
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-xs text-on-muted">{hint}</span>
                </span>
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
