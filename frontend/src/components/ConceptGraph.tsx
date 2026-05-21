import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus, RotateCcw, X } from "lucide-react";
import type { GraphNode, TopicGraph } from "@/api/types";
import {
  layoutConceptGraph,
  scoreNodeStyle,
  NODE_R,
  NODE_W,
  type LayoutNode,
} from "@/lib/graphLayout";
import { MasteryTicks } from "@/components/MasteryTicks";

const CIRC = 2 * Math.PI * NODE_R;
const MIN_SCALE = 0.2;
const MAX_SCALE = 3;
const GRAPH_H = 480;

function ncx(n: LayoutNode) { return n.x + NODE_W / 2; }
function ncy(n: LayoutNode) { return n.y + NODE_R; }
function bottom(n: LayoutNode) { return { x: ncx(n), y: ncy(n) + NODE_R }; }
function top(n: LayoutNode)    { return { x: ncx(n), y: ncy(n) - NODE_R }; }

function wrapLabel(name: string, limit = 14): [string, string | null, string | null] {
  const words = name.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur.length + w.length + 1 > limit && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = cur ? `${cur} ${w}` : w;
    }
  }
  if (cur) lines.push(cur);
  return [lines[0] ?? "", lines[1] ?? null, lines[2] ?? null];
}

function ConceptNode({
  node, isSelected, isHovered, isDimmed,
  onSelect, onHover, onHoverEnd,
}: {
  node: LayoutNode;
  isSelected: boolean;
  isHovered: boolean;
  isDimmed: boolean;
  onSelect: () => void;
  onHover: () => void;
  onHoverEnd: () => void;
}) {
  const st = scoreNodeStyle(node.score_1_to_5, node.num_evaluations > 0);
  const score = node.score_1_to_5;
  const evaluated = node.num_evaluations > 0;
  const cx = ncx(node);
  const cy = ncy(node);

  const progress = evaluated ? Math.max(0, Math.min(1, score / 5)) : 0;
  const dash = progress * CIRC;

  const [l1, l2, l3] = wrapLabel(node.name);
  const labelY = cy + NODE_R + 14;

  const strokeColor = isSelected ? "#d4a853" : isHovered ? "#d4a85380" : st.stroke;

  return (
    <g
      data-node="true"
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onMouseEnter={onHover}
      onMouseLeave={onHoverEnd}
      style={{ cursor: "pointer", opacity: isDimmed ? 0.22 : 1, transition: "opacity 0.18s" }}
      role="button"
      tabIndex={0}
      aria-label={`${node.name}${evaluated ? ` — ${score.toFixed(1)}/5` : " — not started"}`}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect(); }}
    >
      {/* Glow halo */}
      {st.glow && (
        <circle cx={cx} cy={cy} r={NODE_R + 8} fill={st.trackColor} opacity={0.1} filter="url(#node-glow)" />
      )}

      {/* Circle body */}
      <circle cx={cx} cy={cy} r={NODE_R} fill={st.fill} stroke={strokeColor} strokeWidth={isSelected ? 2.5 : 1.5} />

      {/* Progress ring track */}
      <circle cx={cx} cy={cy} r={NODE_R - 4} fill="none" stroke={st.trackColor} strokeWidth={3} strokeOpacity={0.18} />

      {/* Progress ring fill */}
      {progress > 0 && (
        <circle
          cx={cx} cy={cy} r={NODE_R - 4}
          fill="none"
          stroke={st.trackColor}
          strokeWidth={3}
          strokeDasharray={`${dash} ${CIRC}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      )}

      {/* Score text */}
      <text
        x={cx} y={cy + 4}
        textAnchor="middle"
        fill={evaluated ? st.labelColor : "#3a3a50"}
        fontSize={evaluated ? 11 : 10}
        fontFamily="IBM Plex Mono, monospace"
        fontWeight={evaluated ? 600 : 400}
      >
        {evaluated ? score.toFixed(1) : "—"}
      </text>

      {/* Label below circle */}
      <text x={cx} y={labelY} textAnchor="middle" fill="#c8c8d8" fontSize={10} fontFamily="Plus Jakarta Sans, sans-serif" fontWeight={500}>
        {l1}
      </text>
      {l2 && <text x={cx} y={labelY + 13} textAnchor="middle" fill="#c8c8d8" fontSize={10} fontFamily="Plus Jakarta Sans, sans-serif" fontWeight={500}>{l2}</text>}
      {l3 && <text x={cx} y={labelY + 26} textAnchor="middle" fill="#c8c8d8" fontSize={10} fontFamily="Plus Jakarta Sans, sans-serif" fontWeight={500}>{l3}</text>}
    </g>
  );
}

function NodePopup({
  node,
  screenX,
  screenY,
  onClose,
}: {
  node: GraphNode & { score_1_to_5: number; num_evaluations: number };
  screenX: number;
  screenY: number;
  onClose: () => void;
}) {
  const left = Math.max(8, screenX - 130);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.93, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -4 }}
      transition={{ duration: 0.18 }}
      style={{ position: "absolute", top: screenY, left, width: 260, zIndex: 20 }}
      className="rounded-xl border border-accent/25 bg-surface-elevated p-4 shadow-[0_16px_48px_rgb(0_0_0/0.6)] backdrop-blur-xl"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug text-on-surface">{node.name}</p>
        <button
          type="button"
          onClick={onClose}
          className="flex size-5 shrink-0 items-center justify-center rounded text-on-muted hover:text-on-surface"
        >
          <X className="size-3" />
        </button>
      </div>

      {node.description && (
        <p className="mt-2 text-xs leading-relaxed text-on-muted">{node.description}</p>
      )}

      {node.num_evaluations > 0 && (
        <div className="mt-3 flex items-center gap-2 border-t border-line/40 pt-3">
          <MasteryTicks score={Math.round(node.score_1_to_5)} />
          <span className="font-mono text-[10px] text-on-muted">
            {node.score_1_to_5.toFixed(1)}/5 · {node.num_evaluations} eval
            {node.num_evaluations !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {node.prerequisites.length > 0 && (
        <p className="mt-2 text-[10px] text-on-muted/60">
          Requires: {node.prerequisites.join(", ")}
        </p>
      )}
    </motion.div>
  );
}

interface Transform { x: number; y: number; scale: number }

export function ConceptGraph({ graph }: { graph: TopicGraph }) {
  const { layout, width, height, edges } = useMemo(
    () => layoutConceptGraph(graph.nodes),
    [graph.nodes],
  );
  const pos     = useMemo(() => new Map(layout.map((n) => [n.id, n])), [layout]);
  const nodeMap = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId,  setHoveredId]  = useState<string | null>(null);
  const [tf, setTf] = useState<Transform>({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const panOrigin = useRef({ x: 0, y: 0 });
  const didMove = useRef(false);

  const fitGraph = useCallback(() => {
    const el = containerRef.current;
    if (!el || width === 0 || height === 0) return;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    const scale = Math.min((cw - 32) / width, (ch - 32) / height, 1);
    setTf({ x: (cw - width * scale) / 2, y: (ch - height * scale) / 2, scale });
  }, [width, height]);

  useEffect(() => { fitGraph(); }, [fitGraph]);

  function zoomBy(factor: number, pivotX?: number, pivotY?: number) {
    const el = containerRef.current;
    const px = pivotX ?? (el ? el.clientWidth / 2 : 0);
    const py = pivotY ?? (el ? el.clientHeight / 2 : 0);
    setTf((t) => {
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, t.scale * factor));
      const ratio = newScale / t.scale;
      return { scale: newScale, x: px - ratio * (px - t.x), y: py - ratio * (py - t.y) };
    });
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const rect = containerRef.current!.getBoundingClientRect();
    zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - rect.left, e.clientY - rect.top);
  }

  function onMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    if ((e.target as Element).closest("[data-node]")) return;
    didMove.current = false;
    panOrigin.current = { x: e.clientX - tf.x, y: e.clientY - tf.y };
    setIsPanning(true);
  }

  function onMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!isPanning) return;
    didMove.current = true;
    setTf((t) => ({ ...t, x: e.clientX - panOrigin.current.x, y: e.clientY - panOrigin.current.y }));
  }

  function onMouseUp() { setIsPanning(false); }

  const focal = hoveredId ?? selectedId;

  const connectedIds = useMemo(() => {
    if (!focal) return new Set<string>();
    const s = new Set<string>([focal]);
    for (const { from, to } of edges) {
      if (from === focal || to === focal) { s.add(from); s.add(to); }
    }
    return s;
  }, [focal, edges]);

  const highlightedEdges = useMemo(() => {
    if (!focal) return new Set<string>();
    return new Set(
      edges
        .filter(({ from, to }) => from === focal || to === focal)
        .map(({ from, to }) => `${from}-${to}`),
    );
  }, [focal, edges]);

  const selectedNode = selectedId ? nodeMap.get(selectedId) : null;
  const selectedLayout = selectedId ? pos.get(selectedId) : null;

  // Popup: convert graph coords → screen coords
  const popupScreenX = selectedLayout
    ? ncx(selectedLayout) * tf.scale + tf.x
    : 0;
  const popupScreenY = selectedLayout
    ? (ncy(selectedLayout) - NODE_R - 8) * tf.scale + tf.y - 160
    : 0;

  return (
    <div className="card relative overflow-hidden p-0" style={{ height: GRAPH_H }}>
      <div ref={containerRef} className="h-full w-full">
        <svg
          width="100%"
          height="100%"
          style={{ cursor: isPanning ? "grabbing" : "grab", userSelect: "none" }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onWheel={onWheel}
          role="img"
          aria-label={`Concept map for ${graph.display_name}`}
        >
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0.5 L0,5.5 L7,3 z" fill="currentColor" opacity={0.28} />
            </marker>
            <filter id="node-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <g transform={`translate(${tf.x},${tf.y}) scale(${tf.scale})`}>
            {/* Edges */}
            {edges.map(({ from, to }) => {
              const a = pos.get(from);
              const b = pos.get(to);
              if (!a || !b) return null;
              const s = bottom(a);
              const e = top(b);
              const my = (s.y + e.y) / 2;
              const key = `${from}-${to}`;
              const hi = highlightedEdges.has(key);
              return (
                <path
                  key={key}
                  d={`M ${s.x} ${s.y} C ${s.x} ${my}, ${e.x} ${my}, ${e.x} ${e.y}`}
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity={hi ? 0.6 : 0.12}
                  strokeWidth={hi ? 2.5 : 1.5}
                  markerEnd="url(#arrow)"
                  style={{ transition: "stroke-opacity 0.18s, stroke-width 0.18s" }}
                />
              );
            })}

            {/* Nodes */}
            {layout.map((n) => (
              <ConceptNode
                key={n.id}
                node={n}
                isSelected={selectedId === n.id}
                isHovered={hoveredId === n.id}
                isDimmed={!!focal && !connectedIds.has(n.id)}
                onSelect={() => setSelectedId(selectedId === n.id ? null : n.id)}
                onHover={() => setHoveredId(n.id)}
                onHoverEnd={() => setHoveredId(null)}
              />
            ))}
          </g>
        </svg>
      </div>

      {/* Node detail popup — lives outside SVG transform so it doesn't scale */}
      <AnimatePresence>
        {selectedNode && selectedLayout && (
          <NodePopup
            key={selectedId}
            node={selectedNode}
            screenX={popupScreenX}
            screenY={Math.max(8, popupScreenY)}
            onClose={() => setSelectedId(null)}
          />
        )}
      </AnimatePresence>

      {/* Zoom controls */}
      <div className="absolute right-3 bottom-3 flex flex-col gap-1">
        {[
          { icon: Plus,      title: "Zoom in",  fn: () => zoomBy(1.25) },
          { icon: RotateCcw, title: "Fit",      fn: fitGraph },
          { icon: Minus,     title: "Zoom out", fn: () => zoomBy(0.8) },
        ].map(({ icon: Icon, title, fn }) => (
          <button
            key={title}
            type="button"
            title={title}
            onClick={fn}
            className="flex size-7 items-center justify-center rounded-lg border border-line/50 bg-surface-elevated text-on-muted transition-colors hover:border-line hover:text-on-surface"
          >
            <Icon className="size-3.5" />
          </button>
        ))}
      </div>

      {/* Hint */}
      <p className="absolute bottom-3.5 left-4 text-[10px] text-on-muted/35">
        scroll to zoom · drag to pan · click to inspect
      </p>
    </div>
  );
}
