export function MasteryTicks({ score }: { score: number }) {
  const filled = Math.round(Math.min(5, Math.max(0, score)));
  return (
    <div
      className="flex items-center gap-2 rounded-lg bg-surface-muted/80 px-2.5 py-1.5"
      aria-label={`Mastery ${filled} of 5`}
    >
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <div
            key={n}
            className={`h-2 w-2 rounded-sm ${
              n <= filled
                ? "bg-accent shadow-[0_0_6px_rgb(212_168_83/0.5)]"
                : "bg-line"
            }`}
          />
        ))}
      </div>
      <span className="font-mono text-xs tabular-nums text-on-muted">
        {filled}/5
      </span>
    </div>
  );
}
