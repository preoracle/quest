import { cn } from "@/lib/utils";

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div
      className="inline-flex max-w-full flex-nowrap gap-0.5 overflow-x-auto rounded-xl border border-line/50 bg-surface/30 p-1"
      role="tablist"
    >
      {options.map(({ id, label, count }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={value === id}
          onClick={() => onChange(id)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            value === id
              ? "bg-accent-dim text-accent shadow-sm ring-1 ring-accent/20"
              : "text-on-muted hover:text-on-surface",
          )}
        >
          {label}
          {count !== undefined && count > 0 && (
            <span className="ml-1.5 font-mono text-[11px] tabular-nums opacity-80">
              {count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
