import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Download, Share2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SessionView } from "@/api/types";

function momentumLabel(avg: number | null): string {
  if (avg === null) return "—";
  if (avg >= 4.5) return "Locked in";
  if (avg >= 3.5) return "Strong";
  if (avg >= 3) return "On track";
  if (avg >= 2) return "Building";
  return "Keep going";
}

function formatDate(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function InsightCard({ session }: { session: SessionView }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [capturing, setCapturing] = useState(false);

  const report = session.report;
  const concepts = report?.concepts ?? [];
  const evaluated = report?.evaluated_answers ?? 0;
  const strongCount = concepts.filter((c) => c.last_score >= 4).length;
  const avgScore =
    concepts.length > 0
      ? concepts.reduce((s, c) => s + c.last_score, 0) / concepts.length
      : null;
  const topGaps = (report?.top_gaps ?? []).slice(0, 2);
  const narrative = report?.narrative;
  const topicName = session.topic_display;
  const dateStr = formatDate(session.ended_at);

  const momentum = momentumLabel(avgScore);
  const momentumColor =
    avgScore !== null && avgScore >= 3 ? "#5fd68a" : "#d4a24a";

  async function handleShare() {
    if (!cardRef.current) return;
    setCapturing(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        backgroundColor: "#0a0906",
      });

      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `quest-session-${session.session_id.slice(0, 8)}.png`, {
        type: "image/png",
      });

      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Quest — ${topicName}`,
          text: `I just studied ${topicName} on Quest. ${evaluated} questions, ${strongCount} strong concepts.`,
        });
      } else {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = file.name;
        a.click();
      }
    } finally {
      setCapturing(false);
    }
  }

  if (evaluated === 0) return null;

  return (
    <div className="space-y-3">
      {/* ── Card (captured as PNG) ───────────────────────────────────────── */}
      <div
        ref={cardRef}
        style={{
          background: "linear-gradient(145deg, #161510 0%, #0f0e0b 100%)",
          border: "1px solid #2e2b22",
          borderRadius: "16px",
          padding: "24px",
          width: "100%",
          maxWidth: "480px",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "26px",
                height: "26px",
                background: "rgba(212,162,74,0.15)",
                borderRadius: "6px",
              }}
            >
              <Zap
                style={{ width: "14px", height: "14px", color: "#d4a24a" }}
              />
            </span>
            <span
              style={{
                fontWeight: 700,
                fontSize: "13px",
                letterSpacing: "0.04em",
                color: "#d4a24a",
                textTransform: "uppercase",
              }}
            >
              Quest
            </span>
          </div>
          <span style={{ fontSize: "11px", color: "#9e9a8c" }}>{dateStr}</span>
        </div>

        {/* Topic */}
        <div style={{ marginBottom: "20px" }}>
          <h2
            style={{
              fontSize: "22px",
              fontWeight: 700,
              color: "#f5f2ea",
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            {topicName}
          </h2>
          <p style={{ fontSize: "12px", color: "#9e9a8c", marginTop: "4px" }}>
            Session recap
          </p>
        </div>

        {/* Stats row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "8px",
            marginBottom: "20px",
          }}
        >
          {[
            { value: String(evaluated), label: "Questions", color: "#f5f2ea" },
            { value: String(strongCount), label: "Strong", color: "#5fd68a" },
            { value: momentum, label: "Momentum", color: momentumColor },
          ].map(({ value, label, color }) => (
            <div
              key={label}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid #2e2b22",
                borderRadius: "10px",
                padding: "10px 12px",
              }}
            >
              <div
                style={{
                  fontSize: "17px",
                  fontWeight: 700,
                  color,
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: 1.2,
                }}
              >
                {value}
              </div>
              <div style={{ fontSize: "11px", color: "#9e9a8c", marginTop: "3px" }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Gaps */}
        {topGaps.length > 0 && (
          <div style={{ marginBottom: "16px" }}>
            <p
              style={{
                fontSize: "10px",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#9e9a8c",
                marginBottom: "6px",
              }}
            >
              Areas to revisit
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {topGaps.map((gap) => (
                <span
                  key={gap}
                  style={{
                    fontSize: "11px",
                    color: "#d4a24a",
                    background: "rgba(212,162,74,0.1)",
                    border: "1px solid rgba(212,162,74,0.25)",
                    borderRadius: "6px",
                    padding: "3px 8px",
                  }}
                >
                  {gap}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Narrative */}
        {narrative && (
          <div
            style={{
              borderTop: "1px solid #2e2b22",
              paddingTop: "14px",
              marginBottom: "16px",
            }}
          >
            <p
              style={{
                fontSize: "12px",
                color: "#9e9a8c",
                lineHeight: 1.6,
                margin: 0,
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              "{narrative}"
            </p>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            borderTop: "1px solid #2e2b22",
            paddingTop: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: "10px", color: "#9e9a8c", letterSpacing: "0.05em" }}>
            questapp.ai
          </span>
          <span
            style={{
              fontSize: "10px",
              color: "#9e9a8c",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span style={{ color: "#d4a24a" }}>◆</span> built with SM-2
          </span>
        </div>
      </div>

      {/* Share button (not captured) */}
      <Button
        variant="outline"
        size="sm"
        disabled={capturing}
        onClick={handleShare}
        className="gap-2"
      >
        {typeof navigator.canShare === "function" ? (
          <>
            <Share2 className="size-3.5" />
            {capturing ? "Preparing…" : "Share insight"}
          </>
        ) : (
          <>
            <Download className="size-3.5" />
            {capturing ? "Exporting…" : "Save as image"}
          </>
        )}
      </Button>
    </div>
  );
}
