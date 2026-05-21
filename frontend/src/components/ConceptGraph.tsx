import { useMemo } from "react";
import type { TopicGraph } from "@/api/types";
import {
  layoutConceptGraph,
  scoreNodeStyle,
  type LayoutNode,
} from "@/lib/graphLayout";

function nodeCenter(n: LayoutNode) {
  return { cx: n.x + 70, cy: n.y + 24 };
}

export function ConceptGraph({ graph }: { graph: TopicGraph }) {
  const { layout, width, height, edges } = useMemo(
    () => layoutConceptGraph(graph.nodes),
    [graph.nodes],
  );
  const pos = useMemo(() => new Map(layout.map((n) => [n.id, n])), [layout]);

  return (
    <div className="card overflow-x-auto p-4">
      <svg
        width={width}
        height={height}
        className="min-w-full"
        role="img"
        aria-label={`Concept map for ${graph.display_name}`}
      >
        {edges.map(({ from, to }) => {
          const a = pos.get(from);
          const b = pos.get(to);
          if (!a || !b) return null;
          const { cx: x1, cy: y1 } = nodeCenter(a);
          const { cx: x2, cy: y2 } = nodeCenter(b);
          return (
            <line
              key={`${from}-${to}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="currentColor"
              strokeOpacity={0.2}
              strokeWidth={1.5}
            />
          );
        })}
        {layout.map((n) => {
          const st = scoreNodeStyle(n.score_1_to_5, n.num_evaluations > 0);
          return (
            <g key={n.id} transform={`translate(${n.x}, ${n.y})`}>
              <rect
                width={140}
                height={48}
                rx={8}
                fill={st.fill}
                stroke={st.stroke}
                strokeWidth={1.5}
              />
              <text
                x={8}
                y={18}
                fill="#f4f4f8"
                fontSize={11}
                fontFamily="Plus Jakarta Sans, sans-serif"
              >
                {n.name.length > 18 ? `${n.name.slice(0, 17)}…` : n.name}
              </text>
              <text
                x={8}
                y={36}
                fill={st.label}
                fontSize={10}
                fontFamily="IBM Plex Mono, monospace"
              >
                {n.num_evaluations > 0 ? `${n.score_1_to_5.toFixed(1)}/5` : "—"}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
