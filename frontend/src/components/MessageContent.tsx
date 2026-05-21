import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

type Segment =
  | { type: "text"; content: string }
  | { type: "code"; lang: string; content: string };

function parseMessage(text: string): Segment[] {
  const segments: Segment[] = [];
  const fence = /```([a-z]*)\n([\s\S]*?)```/g;
  let last = 0;
  let match;
  while ((match = fence.exec(text)) !== null) {
    if (match.index > last) {
      segments.push({ type: "text", content: text.slice(last, match.index) });
    }
    segments.push({ type: "code", lang: match[1] || "code", content: match[2].trimEnd() });
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    segments.push({ type: "text", content: text.slice(last) });
  }
  if (segments.length === 0) segments.push({ type: "text", content: text });
  return segments;
}

function CodeBlock({ lang, content }: { lang: string; content: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    void navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative my-2 overflow-hidden rounded-lg border border-line/50 bg-surface-muted">
      <div className="flex items-center justify-between border-b border-line/40 px-3 py-1.5">
        <span className="font-mono text-[9px] font-semibold uppercase tracking-widest text-on-muted/50">
          {lang}
        </span>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1 text-[10px] text-on-muted/50 transition-colors hover:text-on-muted"
        >
          {copied ? (
            <Check className="size-3 text-score-good" />
          ) : (
            <Copy className="size-3" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3 font-mono text-[13px] leading-relaxed text-on-surface/90">
        <code>{content}</code>
      </pre>
    </div>
  );
}

export function MessageContent({ text, className }: { text: string; className?: string }) {
  const segments = parseMessage(text);
  return (
    <span className={cn("block", className)}>
      {segments.map((seg, i) =>
        seg.type === "code" ? (
          <CodeBlock key={i} lang={seg.lang} content={seg.content} />
        ) : (
          <span key={i} className="whitespace-pre-wrap">
            {seg.content}
          </span>
        ),
      )}
    </span>
  );
}
