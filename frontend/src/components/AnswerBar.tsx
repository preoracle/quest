import { FormEvent, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Mic, PenLine, Send } from "lucide-react";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { ContentTrack } from "@/components/ContentColumn";
import { gutterPx } from "@/lib/layout";
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scratchRef = useRef<HTMLTextAreaElement>(null);
  const [showScratch, setShowScratch] = useState(false);
  const [scratch, setScratch] = useState("");

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  useEffect(() => {
    const el = scratchRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [scratch]);

  useEffect(() => {
    if (showScratch) scratchRef.current?.focus();
  }, [showScratch]);

  useEffect(() => {
    if (!value) {
      setScratch("");
      setShowScratch(false);
    }
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
  const wordCountReady = wordCount >= 25;

  return (
    <form onSubmit={handleSubmit} className={cn("shrink-0 pb-2", gutterPx)}>
      <ContentTrack tier="reading">
        {/* Scratchpad — collapsible writing scratch area */}
        <AnimatePresence initial={false}>
          {showScratch && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="border-b border-line/25 pb-3 pt-4">
                <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-widest text-on-muted/35">
                  Scratch / notes
                </p>
                <textarea
                  ref={scratchRef}
                  value={scratch}
                  onChange={(e) => setScratch(e.target.value)}
                  placeholder="Rough thinking, pseudocode, scratch work…"
                  rows={2}
                  className="w-full resize-none overflow-y-auto bg-transparent font-mono text-sm leading-relaxed text-on-muted/70 placeholder:text-on-muted/25 focus:outline-none"
                  style={{ minHeight: "2.75rem", maxHeight: "7rem" }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main answer — open writing surface */}
        <div className="pt-4">
          <label htmlFor="answer" className="sr-only">
            Your answer
          </label>
          <textarea
            ref={textareaRef}
            id="answer"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={disabled || submitting}
            rows={1}
            placeholder="Write your reasoning here…"
            className="w-full resize-none overflow-y-auto bg-transparent font-mono font-medium text-base leading-[1.7] text-on-surface placeholder:text-on-muted/40 focus:outline-none"
            style={{ minHeight: "4.5rem", maxHeight: "11rem" }}
          />
        </div>

        {/* Toolbar — quiet action row */}
        <div className="mt-2 flex items-center gap-2 border-t border-line/30 pt-2.5 pb-3">
          <button
            type="button"
            onClick={() => setShowScratch((v) => !v)}
            title={showScratch ? "Hide scratch pad" : "Open scratch pad"}
            className={cn(
              "flex size-8 items-center justify-center rounded-md transition-colors",
              showScratch
                ? "bg-accent/15 text-accent"
                : "text-on-muted/35 hover:text-on-muted/70",
            )}
          >
            <PenLine className="size-4" />
          </button>

          <span
            className={cn(
              "tabular-nums text-xs transition-colors",
              wordCount === 0
                ? "text-on-muted/20"
                : wordCountReady
                  ? "font-medium text-accent/80"
                  : "text-on-muted/45",
            )}
          >
            {wordCount}w
          </span>

          <div className="flex-1" />

          {supported && (
            <button
              type="button"
              onClick={toggle}
              disabled={disabled || submitting}
              aria-pressed={listening}
              aria-label={listening ? "Stop dictation" : "Start dictation"}
              className={cn(
                "flex size-8 items-center justify-center rounded-md transition-colors",
                listening
                  ? "bg-accent/20 text-accent ring-1 ring-accent/30"
                  : "text-on-muted/35 hover:text-on-muted/70",
              )}
            >
              <Mic className="size-4" />
            </button>
          )}

          {listening ? (
            <span className="text-xs font-medium text-accent">Listening…</span>
          ) : (
            <span className="hidden items-center gap-0.5 sm:flex">
              <kbd className="rounded border border-line/60 bg-surface-muted/60 px-1 py-0.5 font-mono text-[11px] text-on-muted/40">
                ⌘
              </kbd>
              <kbd className="rounded border border-line/60 bg-surface-muted/60 px-1 py-0.5 font-mono text-[11px] text-on-muted/40">
                ↵
              </kbd>
            </span>
          )}

          <Button
            type="submit"
            size="sm"
            disabled={submitting || !value.trim() || disabled}
          >
            {submitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Evaluating
              </>
            ) : (
              <>
                Submit
                <Send className="size-4" />
              </>
            )}
          </Button>
        </div>
      </ContentTrack>
    </form>
  );
}
