import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Tailwind class for a progress bar fill based on avg score (1–5 scale). */
export function progressBarColor(avgScore: number): string {
  if (avgScore >= 4) return "bg-score-good";
  if (avgScore >= 3) return "bg-accent";
  if (avgScore > 0) return "bg-score-low/80";
  return "bg-accent/60";
}
