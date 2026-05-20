import type {
  MasteryResponse,
  SessionView,
  Topic,
} from "./types";

const API_BASE = import.meta.env.VITE_API_URL ?? "/api";
const USER_ID = "default";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || res.statusText);
  }
  return res.json() as Promise<T>;
}

export function fetchTopics(): Promise<Topic[]> {
  return request<Topic[]>("/topics");
}

export function startSession(
  topic: string,
  resume = true,
  replay = false,
): Promise<SessionView> {
  return request<SessionView>("/sessions", {
    method: "POST",
    body: JSON.stringify({ user_id: USER_ID, topic, resume, replay }),
  });
}

export function submitTurn(
  sessionId: string,
  answer: string,
): Promise<SessionView> {
  return request<SessionView>(`/sessions/${sessionId}/turn`, {
    method: "POST",
    body: JSON.stringify({ answer }),
  });
}

export function fetchSession(sessionId: string): Promise<SessionView> {
  return request<SessionView>(`/sessions/${sessionId}`);
}

export function fetchMastery(topic?: string): Promise<MasteryResponse> {
  const q = topic ? `?topic=${encodeURIComponent(topic)}` : "";
  return request<MasteryResponse>(`/users/${USER_ID}/mastery${q}`);
}

export { USER_ID };
