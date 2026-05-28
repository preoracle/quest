import { FormEvent, useEffect, useRef } from "react";
import { Loader2, Mic, Send } from "lucide-react";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { ContentTrack } from "@/components/ContentColumn";
import { gutterPx } from "@/lib/layout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function wordCountLabel(count: number): { text: string; class: string } {
  if (count === 0) return { text: "", class: "text-on-muted/20" };
  if (count < 15) return { text: `${count}w`, class: "text-on-muted/40" };
  if (count < 25) return { text: `${count}w · Keep going`, class: "text-on-muted/55" };
  if (count < 50) return { text: `${count}w · Strong answer`, class: "text-accent/75 font-medium" };
  return { text: `${count}w · Thorough`, class: "text-score-good/80 font-medium" };
}

export function AnswerBar({
  value,
  onChange,
  onSubmit,
  submitting,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  disabled?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const { supported, listening, toggle } = useSpeechToText({
    baseText: value,
    onPhrase: onChange,
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      onSubmit();
    }
  }

  const wordCount = value.trim() ? value.trim().split(/\s+/).filter(Boolean).length : 0;
  const wLabel = wordCountLabel(wordCount);
  const canSubmit = wordCount >= 1 && !submitting && !disabled;

  return (
    <form onSubmit={handleSubmit} className={cn("shrink-0 pb-3", gutterPx)}>
      <ContentTrack tier="reading">
        <div className="rounded-2xl border border-line/50 bg-surface-elevated/75 overflow-hidden">
          {/* Main answer — writing surface */}
          <div className="px-4 pt-4">
            <label htmlFor="answer" className="sr-only">Your answer</label>
            <textarea
              ref={textareaRef}
              id="answer"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={disabled || submitting}
              rows={4}
              placeholder="Write your reasoning here — explain it as if teaching someone else…"
              className={cn(
                "w-full resize-none overflow-y-auto bg-transparent",
                "font-mono font-medium text-[15px] leading-[1.85]",
                "text-on-surface placeholder:text-on-muted/35 focus:outline-none",
                "writing-surface",
              )}
              style={{ minHeight: "7rem" }}
            />
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-2 border-t border-line/25 px-4 pt-2.5 pb-3">
            {/* Word count with contextual copy */}
            <span className={cn("tabular-nums text-xs transition-colors", wLabel.class)}>
              {wLabel.text}
            </span>

            <div className="flex-1" />

            {/* Speech to text */}
            {supported && (
              <button
                type="button"
                onClick={toggle}
                disabled={disabled || submitting}
                aria-pressed={listening}
                aria-label={listening ? "Stop dictation" : "Start dictation"}
                className={cn(
                  "flex size-7 items-center justify-center rounded-md transition-colors",
                  listening
                    ? "bg-accent/20 text-accent ring-1 ring-accent/30"
                    : "text-on-muted/35 hover:text-on-muted/60",
                )}
              >
                <Mic className="size-3.5" />
              </button>
            )}

            {listening ? (
              <span className="text-xs font-medium text-accent">Listening…</span>
            ) : (
              <span className="hidden items-center gap-0.5 sm:flex">
                <kbd className="rounded border border-line/50 bg-surface-muted/60 px-1 py-0.5 font-mono text-[10px] text-on-muted/40">
                  ⌘
                </kbd>
                <kbd className="rounded border border-line/50 bg-surface-muted/60 px-1 py-0.5 font-mono text-[10px] text-on-muted/40">
                  ↵
                </kbd>
              </span>
            )}

            <Button
              type="submit"
              size="sm"
              disabled={!canSubmit}
            >
              {submitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Evaluating
                </>
              ) : (
                <>
                  Submit
                  <Send className="size-3.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </ContentTrack>
    </form>
  );
}
