import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, FileUp, Loader2 } from "lucide-react";
import { importTopicYaml } from "@/api/client";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  draftToYaml,
  emptyDraft,
  isDraftReady,
  parseTopicYaml,
  type TopicDraft,
} from "@/lib/topicYaml";

type Step = "paste" | "form";

export function YamlImportModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("paste");
  const [raw, setRaw] = useState("");
  const [draft, setDraft] = useState<TopicDraft>(emptyDraft());
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep("paste");
    setRaw("");
    setDraft(emptyDraft());
    setErrors([]);
    setWarnings([]);
    setImportError(null);
  }, [open]);

  function applyParse(text: string) {
    setRaw(text);
    const result = parseTopicYaml(text);
    setErrors(result.errors);
    setWarnings(result.warnings);
    if (result.draft) {
      setDraft(result.draft);
      if (result.errors.length === 0) setStep("form");
    }
  }

  function onFile(file: File) {
    void file.text().then(applyParse);
  }

  function updateConcept(index: number, patch: Partial<TopicDraft["concepts"][0]>) {
    setDraft((d) => {
      const concepts = [...d.concepts];
      concepts[index] = { ...concepts[index], ...patch };
      const next = { ...d, concepts };
      const yaml = draftToYaml(next);
      const result = parseTopicYaml(yaml);
      setErrors(result.errors);
      setWarnings(result.warnings);
      return next;
    });
  }

  async function onImport() {
    if (!isDraftReady(draft)) return;
    setBusy(true);
    setImportError(null);
    try {
      await importTopicYaml(draftToYaml(draft));
      onCreated();
      onClose();
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import concept map"
      description="Paste or upload YAML — we'll parse it and highlight anything missing."
      className="max-w-2xl"
    >
      {step === "paste" ? (
        <div className="space-y-4">
          <textarea
            value={raw}
            onChange={(e) => applyParse(e.target.value)}
            placeholder={`topic: my_topic\ndisplay_name: My Topic\n\nconcepts:\n  - id: first_idea\n    name: First idea\n    description: ...\n    prerequisites: []`}
            className="min-h-[220px] w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-xs text-on-surface placeholder:text-on-muted/60 focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
            spellCheck={false}
          />
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".yaml,.yml"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.target.value = "";
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <FileUp className="size-4" />
              Choose file
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft(emptyDraft());
                setStep("form");
                setErrors([]);
                setWarnings([]);
              }}
            >
              Start from scratch
            </Button>
          </div>
          {(errors.length > 0 || warnings.length > 0) && (
            <ValidationList errors={errors} warnings={warnings} />
          )}
          {draft.topic && errors.length === 0 && (
            <Button size="sm" onClick={() => setStep("form")}>
              Continue to review
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs">
              <span className="mb-1 block text-on-muted">Topic id</span>
              <Input
                value={draft.topic}
                onChange={(e) => {
                  const topic = e.target.value;
                  setDraft((d) => {
                    const next = { ...d, topic };
                    const result = parseTopicYaml(draftToYaml(next));
                    setErrors(result.errors);
                    setWarnings(result.warnings);
                    return next;
                  });
                }}
                className="font-mono text-sm"
                placeholder="snake_case"
              />
            </label>
            <label className="block text-xs sm:col-span-1">
              <span className="mb-1 block text-on-muted">Display name</span>
              <Input
                value={draft.display_name}
                onChange={(e) => {
                  const display_name = e.target.value;
                  setDraft((d) => {
                    const next = { ...d, display_name };
                    const result = parseTopicYaml(draftToYaml(next));
                    setErrors(result.errors);
                    setWarnings(result.warnings);
                    return next;
                  });
                }}
              />
            </label>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-on-muted">
              Concepts ({draft.concepts.filter((c) => c.id && c.name).length}/5 min)
            </p>
            <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
              {draft.concepts.map((c, i) => (
                <div key={i} className="rounded-lg border border-line/60 bg-surface/50 p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      value={c.id}
                      onChange={(e) => updateConcept(i, { id: e.target.value })}
                      placeholder="concept_id"
                      className="font-mono text-xs"
                    />
                    <Input
                      value={c.name}
                      onChange={(e) => updateConcept(i, { name: e.target.value })}
                      placeholder="Concept name"
                      className="text-sm"
                    />
                  </div>
                  <Input
                    value={c.description}
                    onChange={(e) => updateConcept(i, { description: e.target.value })}
                    placeholder="Short description (optional)"
                    className="mt-2 text-xs"
                  />
                </div>
              ))}
            </div>
          </div>

          <ValidationList errors={errors} warnings={warnings} />

          {importError && (
            <p className="text-sm text-score-low">{importError}</p>
          )}

          <div className="flex flex-wrap gap-2 border-t border-line/60 pt-4">
            <Button variant="outline" size="sm" onClick={() => setStep("paste")}>
              Back
            </Button>
            <Button
              size="sm"
              disabled={busy || !isDraftReady(draft)}
              onClick={() => void onImport()}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              Import topic
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ValidationList({
  errors,
  warnings,
}: {
  errors: string[];
  warnings: string[];
}) {
  if (errors.length === 0 && warnings.length === 0) return null;
  return (
    <div className="space-y-2 text-xs">
      {errors.map((e) => (
        <p key={e} className="flex gap-2 text-score-low">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          {e}
        </p>
      ))}
      {warnings.map((w) => (
        <p key={w} className="text-on-muted">{w}</p>
      ))}
    </div>
  );
}
