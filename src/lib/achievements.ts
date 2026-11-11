// Viewer achievements — pure rules (no DB, unit-tested). Rewards are exclusive buddy outfits or gold.

export type Metric = "tvWatch" | "tvVotes" | "quiz" | "chat" | "streak" | "episodes" | "buddyBuys";
export type Reward = { item: string } | { gold: number };
export type AchievementDef = { id: string; metric: Metric; goal: number; reward: Reward; icon: string };

/** tvWatch counts 10-minute TV watching rewards, so 6 = one hour on air. */
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first-hour", metric: "tvWatch", goal: 6, reward: { gold: 10 }, icon: "📺" },
  { id: "couch", metric: "tvWatch", goal: 30, reward: { item: "halo" }, icon: "🛋️" },
  { id: "voter", metric: "tvVotes", goal: 10, reward: { gold: 15 }, icon: "🗳️" },
  { id: "brain", metric: "quiz", goal: 10, reward: { item: "starshades" }, icon: "🧠" },
  { id: "chatty", metric: "chat", goal: 25, reward: { gold: 15 }, icon: "💬" },
  { id: "streak7", metric: "streak", goal: 7, reward: { item: "medal" }, icon: "🔥" },
  { id: "binge", metric: "episodes", goal: 10, reward: { item: "laurel" }, icon: "🍿" },
  { id: "stylist", metric: "buddyBuys", goal: 3, reward: { gold: 20 }, icon: "🎩" },
];

/** BuddyItem id that marks an achievement as claimed (its primary key makes claiming idempotent). */
export const claimMarker = (id: string) => `ach:${id}`;

export function achievementDef(id: string) {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

export type AchievementState = AchievementDef & { progress: number; done: boolean; claimed: boolean };

export function achievementStates(metrics: Record<Metric, number>, claimed: ReadonlySet<string>): AchievementState[] {
  return ACHIEVEMENTS.map((a) => {
    const progress = Math.min(a.goal, Math.max(0, metrics[a.metric] ?? 0));
    return { ...a, progress, done: progress >= a.goal, claimed: claimed.has(claimMarker(a.id)) };
  });
}
