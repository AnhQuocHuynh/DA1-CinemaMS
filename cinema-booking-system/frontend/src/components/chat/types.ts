import type { ChatSessionSummary } from '../../services/chatbotApi';

export type MessageFeedback = 'up' | 'down';

export interface ParsedTicket {
  orderId: string;
  movieTitle: string;
  dateTime?: string;
  theater?: string;
  room?: string;
  seats?: string;
  status?: string;
  total?: string;
}

export type MessageSegment =
  | { type: 'markdown'; content: string }
  | { type: 'tickets'; tickets: ParsedTicket[] };

export type SessionGroupKey = 'today' | 'yesterday' | 'previous7Days' | 'older';

export interface GroupedSessions {
  key: SessionGroupKey;
  sessions: ChatSessionSummary[];
}

export interface SuggestionChipItem {
  id: string;
  label: string;
  prompt: string;
}

export type FailedChatAction =
  | { type: 'send'; text: string }
  | { type: 'sessions' }
  | { type: 'messages'; sessionId: string };
