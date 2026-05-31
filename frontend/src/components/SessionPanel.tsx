import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { MasteryChart } from "@/components/MasteryChart";
import { Button } from "@/components/ui/button";
import { scoreColor } from "@/lib/cycles";
import type { GraphNode } from "@/api/types";

function useSessionTimer() {
  const startRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)),
      10000,
    );
    return () => clearInterval(id);
  }, []);
  const mins = Math.floor(elapsed / 60);
  if (mins === 0) return `< 1 min`;
  return `${mins} min`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-on-muted/60 font-mono">
      {children}
    </p>
  );
}

/** Topological sort: prerequisites before dependents, preserving DAG order. */
function topoSortNodes(nodes: GraphNode[]): GraphNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const visited = new Set<string>();
  const result: GraphNode[] = [];

  function visit(node: GraphNode) {
    if (visited.has(node.id)) return;
    for (const prereqId of node.prerequisites) {
      const prereq = byId.get(prereqId);
      if (prereq) visit(prereq);
    }
    visited.add(node.id);
    result.push(node);
  }

  for (const node of nodes) visit(node);
  return result;
}

/** Visual knowledge map — DAG as a topological list with score indicators */
function ConceptMap({
  nodes,
  visitedNames,
  activeName,
}: {
  nodes: GraphNode[];
  visitedNames: Set<string>;
  activeName: string | null;
}) {
  if (nodes.length === 0) return null;

  const sorted = topoSortNodes(nodes);
  const doneCount = sorted.filter(
    (n) => visitedNames.has(n.name) && n.name !== activeName,
  ).length;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <SectionLabel>Knowledge map</SectionLabel>
        <p className="font-mono text-[11px] tabular-nums text-on-muted/55">
          {doneCount}/{sorted.length}
        </p>
      </div>

      <div className="space-y-px">
        {sorted.map((node) => {
          const isActive = node.name === activeName;
          const isDone = visitedNames.has(node.name) && !isActive;
          // Depth indent for DAG hierarchy feel
          const depth = node.prerequisites.length;
          const indentCls = depth === 0 ? "" : depth === 1 ? "ml-3" : "ml-5";

          return (
            <div
              key={node.id}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-[5px] transition-all",
                indentCls,
                isActive && "bg-accent/10 ring-1 ring-accent/15",
              )}
            >
              {/* State dot */}
              <span
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] leading-none transition-all",
                  isDone && "bg-score-good/20 text-score-good",
                  isActive && "bg-accent/25 text-accent animate-pulse",
                  !isDone && !isActive && "bg-surface-muted/40 text-on-muted/30",
                )}
              >
                {isDone ? "✓" : isActive ? "▶" : "·"}
              </span>

              {/* Concept name */}
              <span
                className={cn(
                  "flex-1 truncate text-[12px] leading-[1.4]",
                  isDone && "text-on-muted/50 line-through decoration-on-muted/20",
                  isActive && "font-semibold text-on-surface",
                  !isDone && !isActive && "text-on-muted/65",
                )}
              >
                {node.name}
              </span>

              {/* Score dot for visited */}
              {isDone && node.score_1_to_5 > 0 && (
                <span className={cn("font-mono text-[10px] tabular-nums shrink-0", scoreColor(node.score_1_to_5))}>
                  {node.score_1_to_5}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KeyGaps({ gaps }: { gaps: string[] }) {
  if (gaps.length === 0) return null;
  return (
    <div>
      <div className="mb-2.5">
        <SectionLabel>Worth revisiting</SectionLabel>
      </div>
      <ul className="space-y-2">
        {gaps.map((g, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-[12px] leading-[1.55] text-on-muted/75"
          >
            <span className="mt-0.5 shrink-0 text-score-low/60">↳</span>
            <span>{g}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SessionPanel({
  scores,
  nodes,
  visitedNames,
  activeName,
  keyGaps,
  observationNote,
  onWrapUp,
  wrappingUp,
}: {
  scores: number[];
  nodes: GraphNode[];
  visitedNames: Set<string>;
  activeName: string | null;
  keyGaps: string[];
  observationNote?: string;
  onWrapUp: () => void;
  wrappingUp: boolean;
}) {
  const timer = useSessionTimer();
  const avgScore = scores.length > 0
    ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
    : null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5">

        {/* Timer + avg score */}
        <div className="flex items-center justify-between">
          <div>
            <SectionLabel>Session</SectionLabel>
            <p className="mt-0.5 font-mono text-[13px] font-medium text-on-surface/80">{timer}</p>
          </div>
          {avgScore && (
            <div className="text-right">
              <SectionLabel>Avg score</SectionLabel>
              <p className={cn("mt-0.5 font-mono text-[13px] font-bold tabular-nums",
                parseFloat(avgScore) >= 4 ? "text-score-good" :
                parseFloat(avgScore) >= 3 ? "text-score-mid" : "text-score-low"
              )}>
                {avgScore}/5
              </p>
            </div>
          )}
        </div>

        {/* Model-of-me observation — appears after 2+ evals with a consistent gap pattern */}
        {observationNote && (
          <p className="text-[11px] italic leading-relaxed text-on-muted/70">
            {observationNote}
          </p>
        )}

        {/* Knowledge map — concept DAG with live state */}
        {nodes.length > 0 && (
          <>
            <div className="border-t border-line/20" />
            <ConceptMap
              nodes={nodes}
              visitedNames={visitedNames}
              activeName={activeName}
            />
          </>
        )}

        {/* Key gaps */}
        {keyGaps.length > 0 && (
          <>
            <div className="border-t border-line/20" />
            <KeyGaps gaps={keyGaps} />
          </>
        )}

        {/* Score chart — secondary, below the map */}
        {scores.length > 1 && (
          <>
            <div className="border-t border-line/20" />
            <div>
              <div className="mb-3">
                <SectionLabel>Score trend</SectionLabel>
              </div>
              <MasteryChart scores={scores} />
            </div>
          </>
        )}
      </div>

      {/* Wrap up — pinned at bottom */}
      <div className="shrink-0 border-t border-line/20 px-4 py-4">
        <Button
          variant="outline"
          size="sm"
          className="w-full text-[13px]"
          onClick={onWrapUp}
          disabled={wrappingUp}
        >
          {wrappingUp ? "Closing…" : "Pause and reflect"}
        </Button>
      </div>
    </div>
  );
}
