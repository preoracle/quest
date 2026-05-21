/** Quest wordmark — orbit mark (recall loop) + logotype. */

export function QuestLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const tileSize =
    size === "sm" ? "size-8" : size === "lg" ? "size-11" : "size-9";
  const markSize =
    size === "sm" ? "size-5" : size === "lg" ? "size-7" : "size-6";
  const textSize =
    size === "sm" ? "text-lg" : size === "lg" ? "text-3xl" : "text-2xl";

  return (
    <span className="inline-flex items-center gap-2.5">
      {/* Dark gradient tile + hairline border — neutral, doesn't compete with accent */}
      <span
        className={`${tileSize} flex shrink-0 items-center justify-center rounded-xl border border-line/60 bg-gradient-to-b from-surface to-canvas`}
      >
        {/* Orbit mark: near-closed arc (the recall loop) + gold dot (node in motion) */}
        <svg viewBox="0 0 40 40" className={markSize} aria-hidden>
          <path
            d="M20 6 a14 14 0 1 0 13.2 9.3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="text-on-surface"
          />
          <circle cx="32" cy="11" r="2.6" fill="currentColor" className="text-accent" />
        </svg>
      </span>
      <span className={`font-display font-semibold tracking-tight text-on-surface ${textSize}`}>
        Quest
      </span>
    </span>
  );
}
