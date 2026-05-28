import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { MasteryChart } from "@/components/MasteryChart";
import { Button } from "@/components/ui/button";
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
    <p className="text-[11px] font-semibold uppercase tracking-widest text-on-muted/75">
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

function ConceptList({
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
      <div className="mb-3 flex items-baseline justify-between">
        <SectionLabel>Topic</SectionLabel>
        <p className="text-[12px] font-medium tabular-nums text-on-muted/70">
          {doneCount} / {sorted.length}
        </p>
      </div>

      <div className="space-y-px">
        {sorted.map((node) => {
          const isActive = node.name === activeName;
          const isDone = visitedNames.has(node.name) && !isActive;

          return (
            <div
              key={node.id}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors",
                isActive && "bg-accent/10",
              )}
            >
              <span
                className={cn(
                  "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[9px]",
                  isDone && "bg-score-good/20 text-score-good",
                  isActive && "bg-accent/25 text-accent text-[10px]",
                  !isDone && !isActive && "text-on-muted/40",
                )}
              >
                {isDone ? "✓" : isActive ? "▶" : "·"}
              </span>
              <span
                className={cn(
                  "truncate text-[13px] leading-[1.4]",
                  isDone && "text-on-muted/60",
                  isActive && "font-medium text-on-surface",
                  !isDone && !isActive && "text-on-muted/70",
                )}
              >
                {node.name}
              </span>
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
            className="flex items-start gap-2 text-[12px] leading-[1.55] text-on-muted/80"
          >
            <span className="mt-0.5 shrink-0 text-score-low/70">↳</span>
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
  onWrapUp,
  wrappingUp,
}: {
  scores: number[];
  nodes: GraphNode[];
  visitedNames: Set<string>;
  activeName: string | null;
  keyGaps: string[];
  onWrapUp: () => void;
  wrappingUp: boolean;
}) {
  const timer = useSessionTimer();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5">
        {/* Timer */}
        <div className="flex items-center justify-between">
          <SectionLabel>Session</SectionLabel>
          <p className="text-[12px] font-medium tabular-nums text-on-muted/70">
            {timer}
          </p>
        </div>

        {/* Mastery chart */}
        <div>
          <div className="mb-3">
            <SectionLabel>Understanding</SectionLabel>
          </div>
          <MasteryChart scores={scores} />
        </div>

        {/* Concept list */}
        {nodes.length > 0 && (
          <>
            <div className="border-t border-line/20" />
            <ConceptList
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
          {wrappingUp ? "Wrapping up…" : "Wrap up session"}
        </Button>
      </div>
    </div>
  );
}
