/** Quest wordmark — stylized Q mark + title */

export function QuestLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const box =
    size === "sm" ? "size-8" : size === "lg" ? "size-11" : "size-9";
  const text =
    size === "sm" ? "text-lg" : size === "lg" ? "text-3xl" : "text-2xl";

  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className={`${box} relative flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent/25 to-accent/5 ring-1 ring-accent/30`}
      >
        <svg
          viewBox="0 0 32 32"
          className={size === "sm" ? "size-5" : "size-6"}
          aria-hidden
        >
          <path
            d="M16 6a10 10 0 1 0 6.2 17.9L24 26l2.2-1.2-2.1-2.4A10 10 0 0 0 16 6zm0 3a7 7 0 1 1 0 14 7 7 0 0 1 0-14z"
            fill="currentColor"
            className="text-accent"
          />
          <circle cx="22.5" cy="22.5" r="2.5" fill="currentColor" className="text-accent-glow" />
        </svg>
      </span>
      <span className={`font-display font-semibold tracking-tight text-on-surface ${text}`}>
        Quest
      </span>
    </span>
  );
}
