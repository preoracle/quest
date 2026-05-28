const KEY = "quest:streak";

interface StreakStore {
  dates: string[];
}

function toDateStr(d = new Date()) {
  return d.toISOString().split("T")[0];
}

export function recordStudyDay(): void {
  const today = toDateStr();
  const raw = localStorage.getItem(KEY);
  const store: StreakStore = raw ? (JSON.parse(raw) as StreakStore) : { dates: [] };
  if (!store.dates.includes(today)) {
    store.dates = [...store.dates, today].slice(-90);
    localStorage.setItem(KEY, JSON.stringify(store));
  }
}

/** Returns the set of ISO date strings when the user studied (last 90 days). */
export function getStudyDates(): Set<string> {
  const raw = localStorage.getItem(KEY);
  if (!raw) return new Set();
  const store = JSON.parse(raw) as StreakStore;
  return new Set(store.dates);
}

export function getStudyStreak(): number {
  const raw = localStorage.getItem(KEY);
  if (!raw) return 0;
  const store = JSON.parse(raw) as StreakStore;
  const dateSet = new Set(store.dates);
  let streak = 0;
  const cursor = new Date();
  while (true) {
    if (!dateSet.has(toDateStr(cursor))) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
