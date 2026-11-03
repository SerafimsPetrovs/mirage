/** 7-day check-in cycle; day 7 is the jackpot. */
export const CHECKIN_REWARDS = [5, 5, 10, 10, 15, 20, 50] as const;

export function utcDay(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function previousUtcDay(day: string) {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return utcDay(d);
}

/** Given the last check-in (if any) and today, compute new streak and reward. */
export function nextCheckIn(last: { day: string; streak: number } | null, today: string) {
  if (last?.day === today) return null; // already checked in
  const streak = last && last.day === previousUtcDay(today) ? last.streak + 1 : 1;
  const reward = CHECKIN_REWARDS[(streak - 1) % CHECKIN_REWARDS.length];
  return { streak, reward };
}

export function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400_000);
}

/** UTC day keys for the last `n` days, oldest first. */
export function lastNDays(n: number) {
  return Array.from({ length: n }, (_, i) => utcDay(daysAgo(n - 1 - i)));
}
