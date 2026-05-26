import { AreaChart, Area, Tooltip, ReferenceLine, ResponsiveContainer, YAxis } from "recharts";
import { cn } from "@/lib/utils";

function readCSSVar(name: string): string {
  if (typeof window === "undefined") return "#5fd68a";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function scoreColorValue(score: number): string {
  if (score >= 4) return readCSSVar("--color-score-good");
  if (score >= 3) return readCSSVar("--color-score-mid");
  return readCSSVar("--color-score-low");
}

function scoreTailwindText(score: number): string {
  if (score >= 4) return "text-score-good";
  if (score >= 3) return "text-score-mid";
  return "text-score-low";
}

function masteryLabel(score: number): string {
  if (score >= 4) return "Proficient";
  if (score >= 3) return "Developing";
  return "Needs work";
}

function trendDir(scores: number[]): "up" | "down" | null {
  if (scores.length < 2) return null;
  const diff = scores[scores.length - 1] - scores[scores.length - 2];
  if (diff > 0) return "up";
  if (diff < 0) return "down";
  return null;
}

function CustomDot(props: {
  cx?: number;
  cy?: number;
  payload?: { score: number };
  index?: number;
  dataLength?: number;
}) {
  const { cx, cy, payload, index, dataLength } = props;
  if (cx == null || cy == null || !payload) return null;
  const color = scoreColorValue(payload.score);
  const isLast = index === (dataLength ?? 1) - 1;
  return (
    <circle
      key={`dot-${cx}-${cy}`}
      cx={cx}
      cy={cy}
      r={isLast ? 3.5 : 2.5}
      fill={color}
      fillOpacity={isLast ? 1 : 0.6}
      strokeWidth={0}
    />
  );
}

function CustomActiveDot(props: {
  cx?: number;
  cy?: number;
  payload?: { score: number };
}) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload) return null;
  const color = scoreColorValue(payload.score);
  return (
    <g key={`active-${cx}-${cy}`}>
      <circle cx={cx} cy={cy} r={8} fill={color} fillOpacity={0.12} />
      <circle cx={cx} cy={cy} r={4} fill={color} />
    </g>
  );
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { score: number; answer: number } }>;
}) {
  if (!active || !payload?.[0]) return null;
  const { score, answer } = payload[0].payload;
  return (
    <div className="rounded-lg border border-line/30 bg-surface-elevated px-3 py-2 shadow-lg">
      <p className={cn("text-[13px] font-semibold", scoreTailwindText(score))}>
        {score.toFixed(1)} &mdash; {masteryLabel(score)}
      </p>
      <p className="mt-0.5 text-[11px] text-on-muted/50">Answer {answer}</p>
    </div>
  );
}

export function MasteryChart({ scores }: { scores: number[] }) {
  if (scores.length === 0) {
    return (
      <div className="space-y-3">
        <div>
          <p className="text-[26px] font-semibold leading-none text-on-muted/20">—</p>
          <p className="mt-1 text-[13px] text-on-muted/60">No answers yet</p>
        </div>
        <div className="flex h-[80px] items-center justify-center rounded-lg border border-line/15 bg-surface/20">
          <p className="text-[11px] text-on-muted/60">chart appears after first answer</p>
        </div>
      </div>
    );
  }

  const data = scores.map((score, i) => ({ answer: i + 1, score }));
  const current = scores[scores.length - 1];
  const lineColor = scoreColorValue(current);
  const t = trendDir(scores);

  return (
    <div className="space-y-2.5">
      {/* Score hero */}
      <div className="flex items-baseline gap-2">
        <span className={cn("text-[26px] font-semibold leading-none tabular-nums", scoreTailwindText(current))}>
          {current.toFixed(1)}
        </span>
        <span className={cn("text-[13px] font-medium", scoreTailwindText(current))}>
          {masteryLabel(current)}
        </span>
        {t && (
          <span className={cn("ml-auto text-[13px]", scoreTailwindText(current))}>
            {t === "up" ? "↑" : "↓"}
          </span>
        )}
      </div>

      {/* Chart */}
      <div className="rounded-lg bg-surface/20 px-1 py-2">
        <ResponsiveContainer width="100%" height={80}>
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity={0.25} />
                <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <YAxis domain={[0.5, 5.5]} hide />

            {/* Midline at score 3 */}
            <ReferenceLine
              y={3}
              stroke="currentColor"
              strokeOpacity={0.1}
              strokeDasharray="4 4"
              strokeWidth={0.5}
            />

            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: lineColor, strokeOpacity: 0.2, strokeWidth: 1 }}
            />

            <Area
              type="monotone"
              dataKey="score"
              stroke={lineColor}
              strokeWidth={1.75}
              fill="url(#areaGradient)"
              dot={(props) => (
                <CustomDot
                  {...props}
                  dataLength={data.length}
                />
              )}
              activeDot={<CustomActiveDot />}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <p className="text-[11px] text-on-muted/65">
        {scores.length} {scores.length === 1 ? "answer" : "answers"} this session
      </p>
    </div>
  );
}
