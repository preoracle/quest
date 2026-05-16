/** Five-block mastery indicator from Stitch design system. */

export function MasteryBar({ score }: { score: number }) {
  const filled = Math.round(Math.min(5, Math.max(0, score)));
  return (
    <div className="flex gap-1.5" aria-label={`Mastery ${filled} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <div
          key={n}
          className={`h-2.5 w-2.5 ${
            n <= filled
              ? "bg-secondary"
              : "border border-outline-variant bg-transparent"
          }`}
        />
      ))}
    </div>
  );
}
