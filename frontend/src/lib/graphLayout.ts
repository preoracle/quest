import type { GraphNode } from "@/api/types";

export interface LayoutNode extends GraphNode {
  x: number;
  y: number;
  layer: number;
}

export const NODE_R = 28;          // circle radius
export const NODE_LABEL_H = 48;    // space below circle for text
export const NODE_W = 120;         // bounding-box width for layout
export const NODE_H = NODE_R * 2 + 16 + NODE_LABEL_H;  // 136px total cell

const GAP_X = 64;
const GAP_Y = 96;
const PAD   = 40;

/** Top-down DAG: roots on top, dependents below, each layer centered. */
export function layoutConceptGraph(nodes: GraphNode[]): {
  layout: LayoutNode[];
  width: number;
  height: number;
  edges: { from: string; to: string }[];
} {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const layerMap = new Map<string, number>();

  function depth(id: string, visiting = new Set<string>()): number {
    if (layerMap.has(id)) return layerMap.get(id)!;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const n = byId.get(id);
    const prereqs = n?.prerequisites.filter((p) => byId.has(p)) ?? [];
    const d =
      prereqs.length === 0
        ? 0
        : 1 + Math.max(...prereqs.map((p) => depth(p, visiting)));
    visiting.delete(id);
    layerMap.set(id, d);
    return d;
  }

  for (const n of nodes) depth(n.id);

  const byLayer = new Map<number, GraphNode[]>();
  for (const n of nodes) {
    const L = layerMap.get(n.id) ?? 0;
    const list = byLayer.get(L) ?? [];
    list.push(n);
    byLayer.set(L, list);
  }

  const maxLayer = Math.max(0, ...layerMap.values());
  let maxRow = 0;
  for (const [, row] of byLayer) maxRow = Math.max(maxRow, row.length);

  const canvasWidth = maxRow * (NODE_W + GAP_X) - GAP_X + PAD * 2;

  const layout: LayoutNode[] = [];
  for (let L = 0; L <= maxLayer; L++) {
    const row = byLayer.get(L) ?? [];
    const rowW = row.length * (NODE_W + GAP_X) - GAP_X;
    const startX = (canvasWidth - rowW) / 2;
    row.forEach((n, i) => {
      layout.push({
        ...n,
        layer: L,
        x: startX + i * (NODE_W + GAP_X),
        y: PAD + L * (NODE_H + GAP_Y),
      });
    });
  }

  const edges: { from: string; to: string }[] = [];
  for (const n of nodes) {
    for (const p of n.prerequisites) {
      if (byId.has(p)) edges.push({ from: p, to: n.id });
    }
  }

  const width  = canvasWidth;
  const height = PAD + (maxLayer + 1) * (NODE_H + GAP_Y) - GAP_Y + PAD;

  return { layout, width, height, edges };
}

export function scoreNodeStyle(score: number, evaluated: boolean) {
  if (!evaluated || score <= 0) {
    return { fill: "#18181f", stroke: "#2a2a3a", trackColor: "#2a2a3a", labelColor: "#5a5a70", glow: false };
  }
  if (score >= 4) {
    return { fill: "#5fd68a14", stroke: "#5fd68a55", trackColor: "#5fd68a", labelColor: "#5fd68a", glow: true };
  }
  if (score >= 3) {
    return { fill: "#d4a85314", stroke: "#d4a85355", trackColor: "#d4a853", labelColor: "#d4a853", glow: false };
  }
  return { fill: "#f0808014", stroke: "#f0808055", trackColor: "#f08080", labelColor: "#f08080", glow: false };
}
