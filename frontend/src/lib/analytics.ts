import posthog from "posthog-js";

export const analytics = {
  onboardingCompleted: (goal: string) =>
    posthog.capture("onboarding_completed", { goal }),

  sessionStarted: (topicId: string, sessionKind: string) =>
    posthog.capture("session_started", { topic_id: topicId, session_kind: sessionKind }),

  sessionCompleted: (topicId: string, turnCount: number, blindSpots: number) =>
    posthog.capture("session_completed", {
      topic_id: topicId,
      turn_count: turnCount,
      blind_spots: blindSpots,
    }),

  streakExtended: (streakDays: number) =>
    posthog.capture("streak_extended", { streak_days: streakDays }),

  identify: (userId: string, name?: string) => {
    posthog.identify(userId, { name });
  },
};
