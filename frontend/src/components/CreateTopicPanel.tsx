import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Sparkles, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { generateTopic } from "@/api/client";
import { YamlImportModal } from "@/components/YamlImportModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Full-width create panel — sits below search, does not replace it. */
export function CreateTopicPanel({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (topicId?: string) => void;
}) {
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [yamlOpen, setYamlOpen] = useState(false);

  async function onGenerate() {
    if (!goal.trim()) return;
    setBusy(true);
    try {
      const result = await generateTopic(goal.trim());
      setGoal("");
      onClose();
      onCreated(result.topic_id);
      toast.success(`Topic "${result.topic_id}" created`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            key="create-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-accent/25 bg-gradient-to-br from-accent-dim/40 to-surface/30 p-4 shadow-[0_8px_32px_rgb(0_0_0/0.25)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-on-surface">New topic</p>
                  <p className="mt-0.5 text-xs text-on-muted">
                    Describe what you want to learn, or import YAML
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-on-muted transition-colors hover:bg-surface-muted hover:text-on-surface"
                  aria-label="Close"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="e.g. Rust ownership, graph algorithms…"
                  className="h-11 flex-1 border-line/50 bg-void/40"
                  disabled={busy}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && goal.trim()) void onGenerate();
                    if (e.key === "Escape") onClose();
                  }}
                />
                <div className="flex shrink-0 gap-2">
                  <Button
                    disabled={busy || !goal.trim()}
                    onClick={() => void onGenerate()}
                  >
                    {busy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                    Generate
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => setYamlOpen(true)}
                    aria-label="Import YAML"
                  >
                    <Upload className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <YamlImportModal
        open={yamlOpen}
        onClose={() => setYamlOpen(false)}
        onCreated={() => {
          setYamlOpen(false);
          onClose();
          onCreated();
        }}
      />
    </>
  );
}
