import { Badge } from "@/components/ui/badge";

export function ScoreBadge({ score }: { score: number }) {
  const variant =
    score >= 4 ? "good" : score >= 3 ? "mid" : ("low" as const);
  return <Badge variant={variant}>{score}/5</Badge>;
}
