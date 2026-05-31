const GAP_LABELS: Record<string, string> = {
  linguistic_imprecision: "Noticing: you reason correctly but tend to use informal vocabulary.",
  missing_mechanism:      "Noticing: you identify the right factors but tend to skip the causal chain.",
  missing_abstraction:    "Noticing: you trace mechanisms well but miss the formal framework.",
  wrong_model:            "Noticing: your causal model needs recalibration on this topic.",
};

function mode(arr: string[]): string | null {
  if (arr.length === 0) return null;
  const counts = new Map<string, number>();
  for (const v of arr) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = arr[0];
  let bestCount = 0;
  for (const [k, n] of counts) {
    if (n > bestCount) { best = k; bestCount = n; }
  }
  return best;
}

export function deriveObservation(
  evals: Array<{ gap_type?: string | null }>,
): string | null {
  if (evals.length < 2) return null;
  const recentGapTypes = evals
    .slice(-3)
    .map((e) => e.gap_type)
    .filter((gt): gt is string => !!gt && gt !== "none");
  if (recentGapTypes.length === 0) return null;
  const top = mode(recentGapTypes);
  return top ? (GAP_LABELS[top] ?? null) : null;
}
