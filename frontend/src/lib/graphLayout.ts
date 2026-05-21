import type { GraphNode } from "@/api/types";

export interface LayoutNode extends GraphNode {
  x: number;
  y: number;
  layer: number;
}

const NODE_W = 140;
const NODE_H = 48;
const GAP_X = 24;
const GAP_Y = 56;

/** Assign layers via longest path from roots; position in a grid. */
export function layoutConceptGraph(nodes: GraphNode[]): {
  layout: LayoutNode[];
  width: number;
  height: number;
  edges: { from: string; to: string }[];
} {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const layer = new Map<string, number>();

  function depth(id: string, visiting = new Set<string>()): number {
    if (layer.has(id)) return layer.get(id)!;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const n = byId.get(id);
    const prereqs = n?.prerequisites.filter((p) => byId.has(p)) ?? [];
    const d =
      prereqs.length === 0
        ? 0
        : 1 + Math.max(...prereqs.map((p) => depth(p, visiting)));
    visiting.delete(id);
    layer.set(id, d);
    return d;
  }

  for (const n of nodes) depth(n.id);

  const byLayer = new Map<number, GraphNode[]>();
  for (const n of nodes) {
    const L = layer.get(n.id) ?? 0;
    const list = byLayer.get(L) ?? [];
    list.push(n);
    byLayer.set(L, list);
  }

  const maxLayer = Math.max(0, ...layer.values());
  const layout: LayoutNode[] = [];
  let maxRow = 0;

  for (let L = 0; L <= maxLayer; L++) {
    const row = byLayer.get(L) ?? [];
    maxRow = Math.max(maxRow, row.length);
    row.forEach((n, i) => {
      layout.push({
        ...n,
        layer: L,
        x: L * (NODE_W + GAP_X) + 16,
        y: i * (NODE_H + GAP_Y) + 16,
      });
    });
  }

  const edges: { from: string; to: string }[] = [];
  for (const n of nodes) {
    for (const p of n.prerequisites) {
      if (byId.has(p)) edges.push({ from: p, to: n.id });
    }
  }

  const width = (maxLayer + 1) * (NODE_W + GAP_X) + 32;
  const height = maxRow * (NODE_H + GAP_Y) + 32;

  return { layout, width, height, edges };
}

export function scoreNodeStyle(score: number, evaluated: boolean) {
  if (!evaluated || score <= 0) {
    return { fill: "#1f1f28", stroke: "#2a2a36", label: "#9494a8" };
  }
  if (score >= 4) {
    return { fill: "#4ade8018", stroke: "#4ade8066", label: "#5fd68a" };
  }
  if (score >= 3) {
    return { fill: "#d4a85318", stroke: "#d4a85366", label: "#d4a853" };
  }
  return { fill: "#f0808018", stroke: "#f0808066", label: "#f08080" };
}
