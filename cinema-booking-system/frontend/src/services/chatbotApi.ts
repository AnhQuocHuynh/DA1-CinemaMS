import keycloak from '../lib/keycloak';

export const CHATBOT_URL = (import.meta.env.VITE_CHATBOT_URL || 'http://localhost:8086').replace(/\/$/, '');

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  lastMessageAt: string | null;
}

export interface Citation {
  passageId: string;
  sourceId: string;
  title: string;
  locator: string;
  text: string;
}

export interface ChatMessage {
  id: string;
  sender: 'USER' | 'ASSISTANT';
  content: string;
  citations: Citation[];
  createdAt: string;
}

interface Envelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

async function headers(): Promise<HeadersInit> {
  const result: Record<string, string> = { 'Content-Type': 'application/json' };
  if (keycloak.authenticated) {
    try {
      await keycloak.updateToken(30);
    } catch {
      keycloak.logout();
    }
    if (keycloak.token) {
      result.Authorization = `Bearer ${keycloak.token}`;
    }
  }
  return result;
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Chatbot HTTP ${response.status}`);
  }
  const body = (await response.json()) as Envelope<T>;
  return body.data;
}

export async function listConversations(): Promise<Conversation[]> {
  const response = await fetch(`${CHATBOT_URL}/api/chatbot/conversations`, { headers: await headers() });
  return readJson<Conversation[]>(response);
}

export async function createConversation(title?: string): Promise<Conversation> {
  const response = await fetch(`${CHATBOT_URL}/api/chatbot/conversations`, {
    method: 'POST',
    headers: await headers(),
    body: JSON.stringify({ title: title ?? '' }),
  });
  return readJson<Conversation>(response);
}

export async function listMessages(conversationId: string): Promise<ChatMessage[]> {
  const response = await fetch(`${CHATBOT_URL}/api/chatbot/conversations/${conversationId}/messages`, {
    headers: await headers(),
  });
  return readJson<ChatMessage[]>(response);
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const response = await fetch(`${CHATBOT_URL}/api/chatbot/conversations/${conversationId}`, {
    method: 'DELETE',
    headers: await headers(),
  });
  if (!response.ok) {
    throw new Error(`Chatbot HTTP ${response.status}`);
  }
}

export async function streamMessage(
  conversationId: string,
  message: string,
  onEvent: (event: string, data: string) => void,
): Promise<void> {
  const response = await fetch(`${CHATBOT_URL}/api/chatbot/conversations/${conversationId}/stream`, {
    method: 'POST',
    headers: await headers(),
    body: JSON.stringify({ message }),
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
    buffer += decoder.decode(chunk.value, { stream: true });
    let splitAt = buffer.indexOf('\n\n');
    while (splitAt >= 0) {
      emitFrame(buffer.slice(0, splitAt), onEvent);
      buffer = buffer.slice(splitAt + 2);
      splitAt = buffer.indexOf('\n\n');
    }
  }
  if (buffer.trim()) {
    emitFrame(buffer, onEvent);
  }
}

function emitFrame(frame: string, onEvent: (event: string, data: string) => void) {
  let event = 'message';
  const data: string[] = [];
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) {
      event = line.slice('event:'.length).trim();
    } else if (line.startsWith('data:')) {
      const value = line.slice('data:'.length);
      data.push(value.startsWith(' ') ? value.slice(1) : value);
    }
  }
  onEvent(event, data.join('\n'));
}
