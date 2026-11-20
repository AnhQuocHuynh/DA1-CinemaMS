import keycloak from '../lib/keycloak';

const GUEST_TOKEN_STORAGE_KEY = 'cinebot_session_token';
let fallbackGuestToken: string | null = null;

export function resolveChatApiUrl(
  chatbotUrl: string | undefined = import.meta.env.VITE_CHATBOT_URL,
  apiBaseUrl: string | undefined = import.meta.env.VITE_API_BASE_URL,
): string {
  const direct = (chatbotUrl || '').trim().replace(/\/$/, '');
  if (direct) {
    return direct.endsWith('/api/chat') ? direct : `${direct}/api/chat`;
  }
  const base = (apiBaseUrl || 'http://localhost:5000/api').trim().replace(/\/$/, '');
  return `${base}/chat`;
}

export const CHAT_API_URL = resolveChatApiUrl();

export interface ChatSource {
  type: string;
  id?: number | string | null;
  title: string;
  snippet: string;
  similarity?: number | null;
}

export interface ChatSessionSummary {
  id: string;
  title: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ChatMessage {
  id: string | number;
  role: 'user' | 'assistant';
  content: string;
  cached?: boolean;
  createdAt?: string | null;
  sources?: ChatSource[];
}

export interface ChatSessionDetail extends ChatSessionSummary {
  messages: ChatMessage[];
}

export interface ChatResponse {
  sessionId: string | null;
  reply: string;
  cached: boolean;
  suggestedFollowUps: string[];
  sources: ChatSource[];
}

export interface ChatStreamEventPayload {
  chunk: string;
  done: boolean;
  cached?: boolean;
  sessionId?: string;
  sources?: ChatSource[];
  replacement?: string;
}

function generateSessionToken(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID().replace(/-/g, '');
  }
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 14)}`;
}

export function getOrCreateGuestSessionToken(): string {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const existing = window.localStorage.getItem(GUEST_TOKEN_STORAGE_KEY);
      if (existing && existing.trim()) {
        return existing;
      }
      const created = generateSessionToken();
      window.localStorage.setItem(GUEST_TOKEN_STORAGE_KEY, created);
      return created;
    }
  } catch {
    // Fall back to in-memory token if localStorage is blocked.
  }
  if (!fallbackGuestToken) {
    fallbackGuestToken = generateSessionToken();
  }
  return fallbackGuestToken;
}

export async function buildHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Session-Token': getOrCreateGuestSessionToken(),
  };
  if (keycloak.authenticated) {
    try {
      await keycloak.updateToken(30);
    } catch {
      keycloak.logout();
    }
    if (keycloak.token) {
      headers.Authorization = `Bearer ${keycloak.token}`;
    }
  }
  return headers;
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Chatbot HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function listSessions(): Promise<ChatSessionSummary[]> {
  const response = await fetch(`${CHAT_API_URL}/sessions`, {
    headers: await buildHeaders(),
  });
  return readJson<ChatSessionSummary[]>(response);
}

export async function createSession(title?: string): Promise<ChatSessionSummary> {
  const response = await fetch(`${CHAT_API_URL}/sessions`, {
    method: 'POST',
    headers: await buildHeaders(),
    body: JSON.stringify({ title: title ?? null }),
  });
  return readJson<ChatSessionSummary>(response);
}

export async function getSessionDetail(sessionId: string): Promise<ChatSessionDetail> {
  const response = await fetch(`${CHAT_API_URL}/sessions/${sessionId}`, {
    headers: await buildHeaders(),
  });
  return readJson<ChatSessionDetail>(response);
}

export async function renameSession(sessionId: string, title: string): Promise<ChatSessionSummary> {
  const response = await fetch(`${CHAT_API_URL}/sessions/${sessionId}`, {
    method: 'PATCH',
    headers: await buildHeaders(),
    body: JSON.stringify({ title }),
  });
  return readJson<ChatSessionSummary>(response);
}

export async function deleteSession(sessionId: string): Promise<void> {
  const response = await fetch(`${CHAT_API_URL}/sessions/${sessionId}`, {
    method: 'DELETE',
    headers: await buildHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Chatbot HTTP ${response.status}`);
  }
}

export async function sendChatMessage(
  message: string,
  sessionId?: string | null,
): Promise<ChatResponse> {
  const response = await fetch(`${CHAT_API_URL}/message`, {
    method: 'POST',
    headers: await buildHeaders(),
    body: JSON.stringify({ sessionId: sessionId ?? null, message }),
  });
  return readJson<ChatResponse>(response);
}

export async function streamChatMessage(
  sessionId: string | null,
  message: string,
  onPayload: (payload: ChatStreamEventPayload) => void,
): Promise<void> {
  const response = await fetch(`${CHAT_API_URL}/stream`, {
    method: 'POST',
    headers: await buildHeaders(),
    body: JSON.stringify({ sessionId, message }),
  });
  if (!response.ok || !response.body) {
    throw new Error(`Chatbot HTTP ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) {
      break;
    }
    buffer += decoder.decode(chunk.value, { stream: true }).replace(/\r\n/g, '\n');
    let splitAt = buffer.indexOf('\n\n');
    while (splitAt >= 0) {
      emitSseFrame(buffer.slice(0, splitAt), onPayload);
      buffer = buffer.slice(splitAt + 2);
      splitAt = buffer.indexOf('\n\n');
    }
  }

  const trailing = buffer.trim();
  if (trailing) {
    emitSseFrame(trailing, onPayload);
  }
}

function emitSseFrame(
  frame: string,
  onPayload: (payload: ChatStreamEventPayload) => void,
): void {
  const dataLines: string[] = [];
  for (const line of frame.split('\n')) {
    if (line.startsWith('data:')) {
      const value = line.slice('data:'.length);
      dataLines.push(value.startsWith(' ') ? value.slice(1) : value);
    }
  }
  const rawJson = dataLines.join('\n').trim();
  if (!rawJson) {
    return;
  }
  const parsed = JSON.parse(rawJson) as ChatStreamEventPayload;
  onPayload(parsed);
}
