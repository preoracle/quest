import { useState } from "react";
import { Loader2, Sparkles, Upload } from "lucide-react";
import { generateTopic } from "@/api/client";
import { YamlImportModal } from "@/components/YamlImportModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Create topic strip — AI generate + guided YAML import modal */
export function CreateTopicSection({ onCreated }: { onCreated: () => void }) {
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [yamlOpen, setYamlOpen] = useState(false);

  async function onGenerate() {
    if (!goal.trim()) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const t = await generateTopic(goal.trim());
      setSuccess(`Added “${t.display_name}”`);
      setGoal("");
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="card mb-8 border-accent/20 bg-accent-dim/20 p-5">
        <p className="text-sm font-medium text-on-surface">Add a topic</p>
        <p className="mt-1 text-xs text-on-muted">
          Describe a learning goal, or import a concept map you already have
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder='e.g. "Rust ownership for systems programming"'
            className="flex-1"
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === "Enter" && goal.trim()) void onGenerate();
            }}
          />
          <div className="flex gap-2">
            <Button disabled={busy || !goal.trim()} onClick={() => void onGenerate()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Generate
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setYamlOpen(true)}
            >
              <Upload className="size-4" />
              Import YAML
            </Button>
          </div>
        </div>
        {error && <p className="mt-3 text-xs text-score-low">{error}</p>}
        {success && <p className="mt-3 text-xs text-score-good">{success}</p>}
      </section>

      <YamlImportModal
        open={yamlOpen}
        onClose={() => setYamlOpen(false)}
        onCreated={onCreated}
      />
    </>
  );
}
