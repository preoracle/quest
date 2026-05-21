import type { TopicCatalogItem } from "@/api/types";

const KEY = "quest-topic-activity";

type ActivityMap = Record<string, { count: number; lastUsed: number }>;

function read(): ActivityMap {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ActivityMap) : {};
  } catch {
    return {};
  }
}

function write(map: ActivityMap) {
  localStorage.setItem(KEY, JSON.stringify(map));
}

/** Record that the user opened or studied a topic (client-side frequency). */
export function recordTopicUse(topicId: string) {
  const map = read();
  const prev = map[topicId];
  map[topicId] = {
    count: (prev?.count ?? 0) + 1,
    lastUsed: Date.now(),
  };
  write(map);
}

export function getTopicActivity(topicId: string) {
  return read()[topicId];
}

export type TopicSection = "pick_up" | "explore" | "library";

export interface RankedTopic extends TopicCatalogItem {
  section: TopicSection;
  rank: number;
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  return ms / (1000 * 60 * 60 * 24);
}

/** Score topics for adaptive ordering (due > recent > in-progress > new). */
export function rankTopics(topics: TopicCatalogItem[]): RankedTopic[] {
  const activity = read();

  const scored = topics.map((t) => {
    let rank = 0;
    let section: TopicSection = "library";

    if (t.pinned) {
      rank += 2500;
      section = "pick_up";
    }

    if (t.due_count > 0) {
      rank += 2000 + t.due_count * 20;
      section = "pick_up";
    }

    const local = activity[t.id];
    if (local) {
      const days = (Date.now() - local.lastUsed) / (1000 * 60 * 60 * 24);
      if (days < 14) {
        rank += 1500 - days * 40 + Math.min(local.count, 10) * 5;
        section = section === "library" ? "pick_up" : section;
      }
    }

    const serverDays = daysSince(t.last_studied_at);
    if (serverDays !== null && serverDays < 21) {
      rank += 1200 - serverDays * 30;
      if (section === "library") section = "pick_up";
    }

    if (t.started && t.due_count === 0) {
      rank += 400 + t.mastered_count * 2;
      if (section === "library") section = "pick_up";
    }

    if (!t.started) {
      rank += 200;
      if (section === "library") section = "explore";
    }

    return { ...t, section, rank };
  });

  scored.sort((a, b) => b.rank - a.rank || a.display_name.localeCompare(b.display_name));
  return scored;
}

export function groupTopics(ranked: RankedTopic[]) {
  const pickUp = ranked.filter((t) => t.section === "pick_up");
  const explore = ranked.filter((t) => t.section === "explore");
  const library = ranked.filter((t) => t.section === "library");
  return { pickUp, explore, library };
}

export type TopicFilter = "all" | "due" | "in_progress" | "new";

export function filterTopics(topics: RankedTopic[], filter: TopicFilter, query: string) {
  const q = query.trim().toLowerCase();
  return topics.filter((t) => {
    if (filter === "due" && t.due_count === 0) return false;
    if (filter === "in_progress" && !t.started) return false;
    if (filter === "new" && t.started) return false;
    if (!q) return true;
    return (
      t.id.toLowerCase().includes(q) ||
      t.display_name.toLowerCase().includes(q) ||
      t.preview_concepts.some((c) => c.toLowerCase().includes(q))
    );
  });
}
