import { useState } from "react";
import { Archive, ArchiveRestore, Pin, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteTopic, patchTopic } from "@/api/client";
import { Button } from "@/components/ui/button";

interface TopicManageActionsProps {
  id: string;
  displayName: string;
  archived?: boolean;
  pinned?: boolean;
  deletable?: boolean;
  onChanged: () => void;
}

export function TopicManageActions({
  id,
  displayName,
  archived,
  pinned,
  deletable,
  onChanged,
}: TopicManageActionsProps) {
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>, successMsg: string) {
    setBusy(true);
    try {
      await action();
      onChanged();
      toast.success(successMsg);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-on-muted/80">
        Manage
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() =>
            run(
              () => patchTopic(id, { archived: !archived }),
              archived ? `"${displayName}" unarchived` : `"${displayName}" archived`,
            )
          }
        >
          {archived ? (
            <ArchiveRestore className="size-3.5" />
          ) : (
            <Archive className="size-3.5" />
          )}
          {archived ? "Unarchive" : "Archive"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() =>
            run(
              () => patchTopic(id, { pinned: !pinned }),
              pinned ? `"${displayName}" unpinned` : `"${displayName}" pinned`,
            )
          }
        >
          <Pin className="size-3.5" />
          {pinned ? "Unpin" : "Pin"}
        </Button>
        {deletable && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            className="border-score-low/40 text-score-low hover:bg-score-low/10"
            onClick={() => {
              if (
                !window.confirm(
                  `Delete "${displayName}" and all study progress? This cannot be undone.`,
                )
              ) {
                return;
              }
              run(() => deleteTopic(id), `"${displayName}" deleted`);
            }}
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}
