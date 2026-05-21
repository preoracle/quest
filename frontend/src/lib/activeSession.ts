/**
 * Lightweight store for the currently active study session.
 * Persisted to sessionStorage so it survives navigation but not a new tab.
 */

const KEY = "quest:active_session";

export interface ActiveSessionInfo {
  sessionId: string;
  topicDisplay: string;
  topicId: string;
}

export function setActiveSession(info: ActiveSessionInfo | null) {
  if (info) {
    sessionStorage.setItem(KEY, JSON.stringify(info));
  } else {
    sessionStorage.removeItem(KEY);
  }
  window.dispatchEvent(new Event("quest:session-changed"));
}

export function getActiveSession(): ActiveSessionInfo | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ActiveSessionInfo) : null;
  } catch {
    return null;
  }
}
