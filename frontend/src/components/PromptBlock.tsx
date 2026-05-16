/** Tutor question block — Stitch active_session “Zetetic” panel. */

export function PromptBlock({
  label = "Active Voice: Zetetic",
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <article className="relative border-l-2 border-secondary bg-surface-container-low/30 py-4 pl-10">
      <header className="mb-4">
        <span className="font-mono text-xs font-semibold uppercase tracking-widest text-secondary">
          {label}
        </span>
      </header>
      <p className="font-mono text-[15px] leading-relaxed tracking-tight text-on-surface">
        {children}
      </p>
    </article>
  );
}
