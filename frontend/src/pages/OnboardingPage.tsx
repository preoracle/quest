import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { enrollTopic, startSession } from "@/api/client";
import { analytics } from "@/lib/analytics";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { cn } from "@/lib/utils";

interface Goal {
  label: string;
  description: string;
  emoji: string;
  topics: string[];
  startTopic: string;
}

const GOALS: Goal[] = [
  {
    label: "CS Placements / Interviews",
    description: "Prepare for campus placements and technical interviews",
    emoji: "🎯",
    topics: ["computer_networks", "operating_systems", "database_fundamentals"],
    startTopic: "computer_networks",
  },
  {
    label: "GATE CS",
    description: "Build deep understanding for GATE Computer Science",
    emoji: "📐",
    topics: ["operating_systems", "database_fundamentals", "computer_networks"],
    startTopic: "operating_systems",
  },
  {
    label: "Web Development",
    description: "Master JavaScript and the fundamentals that power the web",
    emoji: "🌐",
    topics: ["javascript_core", "computer_networks"],
    startTopic: "javascript_core",
  },
  {
    label: "System Design",
    description: "Think in distributed systems and architecture tradeoffs",
    emoji: "🏗️",
    topics: ["system_design_basics", "database_fundamentals"],
    startTopic: "system_design_basics",
  },
  {
    label: "Custom Topic",
    description: "Choose your own path from the topic library",
    emoji: "✨",
    topics: [],
    startTopic: "",
  },
];

export function OnboardingPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);
  const { supported: pushSupported, permission: pushPermission, subscribe: subscribePush } = usePushSubscription();

  async function handleGoal(goal: Goal) {
    if (loading) return;

    if (!goal.startTopic) {
      localStorage.setItem("quest_onboarded", "1");
      analytics.onboardingCompleted("custom");
      navigate("/topics");
      return;
    }

    setLoading(goal.label);
    try {
      // Enroll user in all topics for this goal in parallel
      await Promise.allSettled(goal.topics.map((t) => enrollTopic(t)));

      // Start a micro-session (3 questions) on the primary topic
      const session = await startSession(goal.startTopic, "resume");

      analytics.onboardingCompleted(goal.label);
      // Mark onboarded so this screen never shows again
      localStorage.setItem("quest_onboarded", "1");

      // Request push permission after user commits to a goal (high-intent moment)
      if (pushSupported && pushPermission === "default") {
        subscribePush().catch(() => {}); // best-effort, don't block navigation
      }

      navigate(`/session/${session.session_id}`);
    } catch {
      setLoading(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-void px-4 py-12">
      <motion.div
        className="w-full max-w-xl"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="mb-3 flex items-center justify-center gap-2">
            <span className="size-1.5 animate-pulse rounded-full bg-accent" />
            <span className="font-display text-sm font-semibold tracking-wide text-on-surface">Quest</span>
          </div>
          <h1 className="text-2xl font-bold text-on-surface">What are you preparing for?</h1>
          <p className="mt-2 text-sm text-on-muted">
            We'll start with a quick 3-question session to find your blind spots.
          </p>
        </div>

        {/* Goal tiles */}
        <div className="flex flex-col gap-3">
          {GOALS.map((goal) => {
            const isLoading = loading === goal.label;
            return (
              <motion.button
                key={goal.label}
                type="button"
                disabled={!!loading}
                onClick={() => void handleGoal(goal)}
                className={cn(
                  "group relative flex items-center gap-4 rounded-2xl border px-5 py-4 text-left transition-all duration-150",
                  "border-line/50 bg-surface-elevated/60 hover:border-accent/40 hover:bg-surface-elevated",
                  "disabled:opacity-60 disabled:cursor-not-allowed",
                  isLoading && "border-accent/50 bg-surface-elevated",
                )}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <span className="text-2xl">{goal.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-on-surface text-sm">{goal.label}</p>
                  <p className="text-xs text-on-muted mt-0.5">{goal.description}</p>
                </div>
                {isLoading ? (
                  <span className="size-4 animate-spin rounded-full border-2 border-accent border-t-transparent flex-shrink-0" />
                ) : (
                  <span className="text-on-muted/40 group-hover:text-accent transition-colors text-sm flex-shrink-0">→</span>
                )}
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
