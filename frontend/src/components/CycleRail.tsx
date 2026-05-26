import { ContentTrack } from "@/components/ContentColumn";
import { CycleChip } from "@/components/CycleChip";
import { gutterPx } from "@/lib/layout";
import { cn } from "@/lib/utils";
import type { CompletedCycle } from "@/lib/cycles";

export function CycleRail({
  cycles,
  expandedIds,
  onToggle,
}: {
  cycles: CompletedCycle[];
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (cycles.length === 0) return null;

  return (
    <div
      className={cn(
        "shrink-0 overflow-y-auto border-b border-line/20",
        gutterPx,
      )}
      style={{ maxHeight: "30vh" }}
    >
      <ContentTrack tier="reading" className="space-y-1.5 py-3">
        {cycles.map((cycle) => (
          <CycleChip
            key={cycle.id}
            cycle={cycle}
            expanded={expandedIds.has(cycle.id)}
            onToggle={() => onToggle(cycle.id)}
          />
        ))}
      </ContentTrack>
    </div>
  );
}
