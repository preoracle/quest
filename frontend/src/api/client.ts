import type {
  BaselineView,
  DueResponse,
  MasteryResponse,
  SessionView,
  StartMode,
  TopicCatalogItem,
  TopicCatalogResponse,
  TopicCreated,
  TopicGraph,
  TopicSummaryResponse,
  TurnItem,
} from "./types";

const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

let _userId = "default";

/** Called once by ClerkUserSync when the authenticated user is known. */
export function setUserId(id: string) {
  _userId = id;
}

export function getUserId() {
  return _userId;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? JSON.stringify(body);
    } catch {
      detail = await res.text().catch(() => detail);
    }
    throw new Error(typeof detail === "string" ? detail : "Request failed");
  }
  return res.json() as Promise<T>;
}

export function patchTopic(
  topicId: string,
  body: {
    display_name?: string;
    archived?: boolean;
    pinned?: boolean;
    new_topic_id?: string;
  },
): Promise<{ topic_id: string; display_name?: string; previous_id?: string }> {
  return request(`/topics/${encodeURIComponent(topicId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteTopic(topicId: string): Promise<void> {
  return request(`/topics/${encodeURIComponent(topicId)}`, {
    method: "DELETE",
  });
}

export function fetchTopics(options?: {
  q?: string;
  includeArchived?: boolean;
}): Promise<TopicCatalogItem[]> {
  const params = new URLSearchParams();
  params.set("user_id", _userId);
  if (options?.q?.trim()) params.set("q", options.q.trim());
  if (options?.includeArchived) params.set("include_archived", "true");
  return request<TopicCatalogResponse>(`/topics?${params.toString()}`).then(
    (r) => r.topics,
  );
}

export function fetchProgressSummary(): Promise<TopicSummaryResponse> {
  return request<TopicSummaryResponse>(`/users/${_userId}/progress/summary`);
}

export function fetchTopicGraph(topicId: string): Promise<TopicGraph> {
  return request<TopicGraph>(
    `/topics/${encodeURIComponent(topicId)}/graph?user_id=${_userId}`,
  );
}

export function generateTopic(goal: string, force = false): Promise<TopicCreated> {
  return request<TopicCreated>("/topics/generate", {
    method: "POST",
    body: JSON.stringify({ goal, force }),
  });
}

export function importTopicYaml(
  yamlText: string,
  force = false,
): Promise<TopicCreated> {
  return request<TopicCreated>("/topics/import", {
    method: "POST",
    body: JSON.stringify({ yaml_text: yamlText, force }),
  });
}

export function startBaseline(topic: string): Promise<BaselineView> {
  return request<BaselineView>("/baseline", {
    method: "POST",
    body: JSON.stringify({ user_id: _userId, topic }),
  });
}

export function submitBaselineAnswer(
  sessionId: string,
  answer: string,
): Promise<BaselineView> {
  return request<BaselineView>(`/baseline/${sessionId}/answer`, {
    method: "POST",
    body: JSON.stringify({ answer }),
  });
}

export function startSession(
  topic: string,
  mode: StartMode = "resume",
): Promise<SessionView> {
  return request<SessionView>("/sessions", {
    method: "POST",
    body: JSON.stringify({
      user_id: _userId,
      topic,
      resume: mode === "resume",
      replay: mode === "replay",
    }),
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

export function fetchSessionTurns(sessionId: string): Promise<TurnItem[]> {
  return request<TurnItem[]>(`/sessions/${sessionId}/turns`);
}

export function finishSession(sessionId: string): Promise<SessionView> {
  return request<SessionView>(`/sessions/${sessionId}/finish`, { method: "POST" });
}

export function fetchMastery(topic?: string): Promise<MasteryResponse> {
  const q = topic ? `?topic=${encodeURIComponent(topic)}` : "";
  return request<MasteryResponse>(`/users/${_userId}/mastery${q}`);
}

export function fetchDue(topic?: string): Promise<DueResponse> {
  const q = topic ? `?topic=${encodeURIComponent(topic)}` : "";
  return request<DueResponse>(`/users/${_userId}/due${q}`);
}
