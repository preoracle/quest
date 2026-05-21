import { FormEvent } from "react";
import { Loader2, Mic, Send } from "lucide-react";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

  return (
    <form
      onSubmit={handleSubmit}
      className="sticky bottom-0 border-t border-line/60 bg-void/90 px-5 py-5 backdrop-blur-xl lg:px-8"
    >
      <div className="mx-auto max-w-[42rem]">
        <div className="card flex gap-3 p-4">
          {supported && (
            <button
              type="button"
              onClick={toggle}
              disabled={disabled || submitting}
              aria-pressed={listening}
              aria-label={listening ? "Stop dictation" : "Start dictation"}
              className={cn(
                "mt-1 flex size-11 shrink-0 items-center justify-center rounded-lg transition-colors",
                listening
                  ? "bg-accent/20 text-accent ring-2 ring-accent/30"
                  : "bg-surface-muted text-on-muted hover:text-accent",
              )}
            >
              <Mic className="size-4" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <label htmlFor="answer" className="sr-only">
              Your answer
            </label>
            <textarea
              id="answer"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={disabled || submitting}
              rows={3}
              placeholder="Write your reasoning here…"
              className="w-full resize-none bg-transparent font-mono text-[15px] leading-relaxed text-on-surface placeholder:text-on-muted/60 focus:outline-none"
            />
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-line/60 pt-3">
              <span className="text-xs text-on-muted">
                {listening ? "Listening…" : "⌘ Enter to submit"}
              </span>
              <Button type="submit" disabled={submitting || !value.trim() || disabled}>
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
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
        </div>
      </div>
    </form>
  );
}
