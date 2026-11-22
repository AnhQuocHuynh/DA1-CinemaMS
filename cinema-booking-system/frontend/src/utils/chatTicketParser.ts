import dayjs from 'dayjs';
import type { ChatSessionSummary } from '../services/chatbotApi';

export type RelativeTimeT = (key: string, options?: Record<string, unknown>) => string;
import type {
  GroupedSessions,
  MessageSegment,
  ParsedTicket,
  SessionGroupKey,
} from '../components/chat/types';

const ORDER_HEADER_RE =
  /^\s*(?:[-*+]|\d+\.)?\s*(?:\*\*|__)?(?:Đơn(?:\s+hàng|\s+đặt\s+vé)?|Order|Booking)\s*#(\d+)(?:\s*(?:\*\*|__)?\s*[:：\-—–]\s*(?:\*\*|__)?\s*(.*)|(?:\*\*|__)?\s*)$/i;

const SUB_FIELD_RE =
  /^\s*(?:[-*+]|\d+\.)?\s*(?:\*\*|__)?(Rạp|Cinema|Theater|Theatre|Phòng(?:\s+chiếu)?|Room|Screen|Hall|Ghế|Seats?|Trạng\s+thái|Status|Thời\s+gian|Suất\s+chiếu|Showtime|Ngày|Date|Time|Tổng(?:\s+tiền)?|Total)(?:\*\*|__)?\s*[:：]\s*(?:\*\*|__)?\s*(.+)$/i;

const KNOWN_STATUS_RE =
  /^(CONFIRMED|PAID|COMPLETED|PENDING|AWAITING_PAYMENT|CANCELLED|CANCELED|REFUNDED|EXPIRED|FAILED)$/i;

const ROOM_HINT_RE = /^(?:Phòng(?:\s+chiếu)?|Room|Screen|Hall)\b/i;

function stripMarkdownEmphasis(value: string): string {
  return value
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/`/g, '')
    .replace(/(^|\s)[*_]([^*_]+)[*_](?=\s|$)/g, '$1$2')
    .trim();
}

function splitVenue(rawVenue: string): { theater?: string; room?: string } {
  const venue = stripMarkdownEmphasis(rawVenue);
  if (!venue) {
    return {};
  }
  const dashIdx = venue.lastIndexOf(' - ');
  if (dashIdx > 0) {
    const left = venue.slice(0, dashIdx).trim();
    const right = venue.slice(dashIdx + 3).trim();
    if (left && right) {
      return { theater: left, room: right };
    }
  }
  if (ROOM_HINT_RE.test(venue)) {
    return { room: venue };
  }
  return { theater: venue };
}

function extractTitleAndTime(rawTitle: string): { movieTitle: string; dateTime?: string } {
  const cleaned = stripMarkdownEmphasis(rawTitle);
  const parenMatch = cleaned.match(/^(.+?)\s*\(([^()]+)\)\s*$/);
  if (parenMatch) {
    const candidateTitle = parenMatch[1].trim();
    const inner = parenMatch[2].trim();
    if (/\d|TBD|:\d|\//i.test(inner)) {
      return {
        movieTitle: candidateTitle,
        dateTime: inner.toUpperCase() === 'TBD' ? undefined : inner,
      };
    }
  }
  return { movieTitle: cleaned };
}

function assignLabeledField(ticket: ParsedTicket, rawLabel: string, rawValue: string): boolean {
  const label = rawLabel.trim().toLowerCase();
  const value = stripMarkdownEmphasis(rawValue);
  if (!value) {
    return false;
  }

  if (label === 'ghế' || label === 'seat' || label === 'seats') {
    ticket.seats = value;
    return true;
  }
  if (label === 'trạng thái' || label === 'status') {
    ticket.status = value.toUpperCase().replace(/\s+/g, '_');
    return true;
  }
  if (label === 'tổng' || label === 'tổng tiền' || label === 'total') {
    ticket.total = value;
    return true;
  }
  if (label === 'rạp' || label === 'cinema' || label === 'theater' || label === 'theatre') {
    const split = splitVenue(value);
    if (split.theater) ticket.theater = split.theater;
    if (split.room && !ticket.room) ticket.room = split.room;
    return true;
  }
  if (label.startsWith('phòng') || label === 'room' || label === 'screen' || label === 'hall') {
    ticket.room = value;
    return true;
  }
  if (
    label === 'thời gian' ||
    label === 'suất chiếu' ||
    label === 'showtime' ||
    label === 'ngày' ||
    label === 'date' ||
    label === 'time'
  ) {
    ticket.dateTime = value;
    return true;
  }
  return false;
}

function parseCommaMetaTokens(ticket: ParsedTicket, metaPart: string): void {
  const tokens = metaPart
    .split(',')
    .map((part) => stripMarkdownEmphasis(part))
    .filter(Boolean);

  let activeField: 'seats' | null = null;

  for (const token of tokens) {
    const labeled = token.match(
      /^(?:(Rạp|Cinema|Theater|Theatre|Phòng(?:\s+chiếu)?|Room|Screen|Hall|Thời\s+gian|Suất\s+chiếu|Showtime|Ngày|Date|Time)\s*[:：]\s+|(Ghế|Seats?|Trạng\s+thái|Status|Tổng(?:\s+tiền)?|Total)(?:\s*[:：]\s*|\s+))(.+)$/i,
    );
    if (labeled) {
      const label = labeled[1] || labeled[2];
      const val = labeled[3];
      assignLabeledField(ticket, label, val);
      activeField = /^(?:ghế|seats?)$/i.test(label) ? 'seats' : null;
      continue;
    }

    if (activeField === 'seats' && /^[A-Z]{1,3}\d{1,3}$/i.test(token)) {
      ticket.seats = ticket.seats ? `${ticket.seats}, ${token}` : token;
      continue;
    }

    activeField = null;

    if (KNOWN_STATUS_RE.test(token)) {
      ticket.status = token.toUpperCase();
      continue;
    }

    if (ROOM_HINT_RE.test(token)) {
      ticket.room = token;
      continue;
    }

    if (!ticket.dateTime && /\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}:\d{2}/.test(token)) {
      ticket.dateTime = token;
      continue;
    }

    if (!ticket.theater) {
      const split = splitVenue(token);
      if (split.theater) ticket.theater = split.theater;
      if (split.room && !ticket.room) ticket.room = split.room;
    }
  }
}

function parseHeaderRest(orderId: string, rawRest: string): ParsedTicket {
  const cleanedRest = stripMarkdownEmphasis(rawRest);
  const ticket: ParsedTicket = {
    orderId,
    movieTitle: '',
  };

  if (!cleanedRest) {
    return ticket;
  }

  if (cleanedRest.includes('|')) {
    const parts = cleanedRest
      .split('|')
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      const first = extractTitleAndTime(parts[0]);
      ticket.movieTitle = first.movieTitle;
      if (first.dateTime) {
        ticket.dateTime = first.dateTime;
      }
    }
    for (let idx = 1; idx < parts.length; idx += 1) {
      const part = parts[idx];
      const labeled = part.match(/^([^:：]+)\s*[:：]\s*(.+)$/);
      if (labeled && assignLabeledField(ticket, labeled[1], labeled[2])) {
        continue;
      }
      if (KNOWN_STATUS_RE.test(part)) {
        ticket.status = part.toUpperCase();
        continue;
      }
      if (!ticket.theater && !ticket.room) {
        const split = splitVenue(part);
        ticket.theater = split.theater;
        ticket.room = split.room;
      }
    }
    return ticket;
  }

  // Handle single-line formats like:
  // "Upcoming Movie — CGV HUNG VUONG PLAZA, Phòng A3, Ghế A1, A2, Trạng thái: CONFIRMED"
  // or "Upcoming Movie, CGV HUNG VUONG PLAZA, Phòng A3, Ghế A1, A2"
  const emDashMatch = cleanedRest.match(/^(.+?)\s+[—–]\s+(.+)$/);
  if (emDashMatch) {
    const titleInfo = extractTitleAndTime(emDashMatch[1]);
    ticket.movieTitle = titleInfo.movieTitle;
    if (titleInfo.dateTime) {
      ticket.dateTime = titleInfo.dateTime;
    }
    parseCommaMetaTokens(ticket, emDashMatch[2]);
    return ticket;
  }

  if (cleanedRest.includes(',')) {
    const firstComma = cleanedRest.indexOf(',');
    const titleCandidate = cleanedRest.slice(0, firstComma).trim();
    const metaCandidate = cleanedRest.slice(firstComma + 1).trim();
    const titleInfo = extractTitleAndTime(titleCandidate);
    ticket.movieTitle = titleInfo.movieTitle;
    if (titleInfo.dateTime) {
      ticket.dateTime = titleInfo.dateTime;
    }
    parseCommaMetaTokens(ticket, metaCandidate);
    return ticket;
  }

  const titleInfo = extractTitleAndTime(cleanedRest);
  ticket.movieTitle = titleInfo.movieTitle;
  if (titleInfo.dateTime) {
    ticket.dateTime = titleInfo.dateTime;
  }
  return ticket;
}

function hasEnoughTicketFields(ticket: ParsedTicket): boolean {
  if (!ticket.orderId || !ticket.movieTitle) {
    return false;
  }
  const extraCount = [
    ticket.dateTime,
    ticket.theater,
    ticket.room,
    ticket.seats,
    ticket.status,
    ticket.total,
  ].filter(Boolean).length;
  return extraCount >= 1;
}

export function parseMessageTicketSegments(content: string): MessageSegment[] {
  if (!content || !content.trim()) {
    return [];
  }

  const lines = content.split(/\r?\n/);
  const rawParts: Array<{ type: 'markdown'; line: string } | { type: 'ticket'; ticket: ParsedTicket }> = [];
  let inCodeFence = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      inCodeFence = !inCodeFence;
      rawParts.push({ type: 'markdown', line });
      continue;
    }

    if (inCodeFence) {
      rawParts.push({ type: 'markdown', line });
      continue;
    }

    const headerMatch = line.match(ORDER_HEADER_RE);
    if (!headerMatch) {
      rawParts.push({ type: 'markdown', line });
      continue;
    }

    const orderId = headerMatch[1];
    const rest = headerMatch[2] ?? '';
    const candidate = parseHeaderRest(orderId, rest);
    const consumedLines = [line];

    let j = i + 1;
    while (j < lines.length) {
      const nextLine = lines[j];
      if (!nextLine.trim()) {
        break;
      }
      if (ORDER_HEADER_RE.test(nextLine)) {
        break;
      }
      const subMatch = nextLine.match(SUB_FIELD_RE);
      if (!subMatch) {
        break;
      }
      assignLabeledField(candidate, subMatch[1], subMatch[2]);
      consumedLines.push(nextLine);
      j += 1;
    }

    if (hasEnoughTicketFields(candidate)) {
      rawParts.push({ type: 'ticket', ticket: candidate });
      i = j - 1;
    } else {
      for (const rawLine of consumedLines) {
        rawParts.push({ type: 'markdown', line: rawLine });
      }
      i = j - 1;
    }
  }

  const segments: MessageSegment[] = [];
  let mdBuffer: string[] = [];
  let ticketBuffer: ParsedTicket[] = [];

  const flushMarkdown = () => {
    if (mdBuffer.length > 0) {
      const joined = mdBuffer.join('\n').trim();
      if (joined) {
        segments.push({ type: 'markdown', content: joined });
      }
      mdBuffer = [];
    }
  };

  const flushTickets = () => {
    if (ticketBuffer.length > 0) {
      segments.push({ type: 'tickets', tickets: ticketBuffer });
      ticketBuffer = [];
    }
  };

  for (const part of rawParts) {
    if (part.type === 'ticket') {
      flushMarkdown();
      ticketBuffer.push(part.ticket);
    } else {
      flushTickets();
      mdBuffer.push(part.line);
    }
  }

  flushTickets();
  flushMarkdown();

  return segments;
}

export function groupSessionsByDate(
  sessions: ChatSessionSummary[],
  now: Date = new Date(),
): GroupedSessions[] {
  const todayStart = dayjs(now).startOf('day');
  const yesterdayStart = todayStart.subtract(1, 'day');
  const weekStart = todayStart.subtract(7, 'day');

  const sorted = [...sessions].sort((a, b) => {
    const aRaw = a.updatedAt || a.createdAt;
    const bRaw = b.updatedAt || b.createdAt;
    const aTime = aRaw ? Date.parse(aRaw) : Number.NaN;
    const bTime = bRaw ? Date.parse(bRaw) : Number.NaN;
    const aValid = !Number.isNaN(aTime);
    const bValid = !Number.isNaN(bTime);
    if (aValid && bValid) return bTime - aTime;
    if (aValid) return -1;
    if (bValid) return 1;
    return 0;
  });

  const buckets: Record<SessionGroupKey, ChatSessionSummary[]> = {
    today: [],
    yesterday: [],
    previous7Days: [],
    older: [],
  };

  for (const session of sorted) {
    const rawDate = session.updatedAt || session.createdAt;
    if (!rawDate) {
      buckets.today.push(session);
      continue;
    }
    const parsed = dayjs(rawDate);
    if (!parsed.isValid()) {
      buckets.today.push(session);
      continue;
    }
    if (!parsed.isBefore(todayStart)) {
      buckets.today.push(session);
    } else if (!parsed.isBefore(yesterdayStart)) {
      buckets.yesterday.push(session);
    } else if (!parsed.isBefore(weekStart)) {
      buckets.previous7Days.push(session);
    } else {
      buckets.older.push(session);
    }
  }

  const order: SessionGroupKey[] = ['today', 'yesterday', 'previous7Days', 'older'];
  return order
    .filter((key) => buckets[key].length > 0)
    .map((key) => ({ key, sessions: buckets[key] }));
}

export function formatRelativeTime(
  isoDate?: string | null,
  lang: 'en' | 'vi' = 'en',
  t?: RelativeTimeT,
  now: Date = new Date(),
): string {
  if (!isoDate) {
    return '';
  }
  const timestamp = Date.parse(isoDate);
  if (Number.isNaN(timestamp)) {
    return '';
  }
  const diffSec = Math.max(0, Math.floor((now.getTime() - timestamp) / 1000));
  if (diffSec < 60) {
    return t ? t('cinebot.justNow') : lang === 'vi' ? 'Vừa xong' : 'Just now';
  }
  if (diffSec < 3600) {
    const count = Math.floor(diffSec / 60);
    return t
      ? t('cinebot.minutesAgo', { count })
      : lang === 'vi'
        ? `${count} phút trước`
        : `${count}m ago`;
  }
  if (diffSec < 86400) {
    const count = Math.floor(diffSec / 3600);
    return t
      ? t('cinebot.hoursAgo', { count })
      : lang === 'vi'
        ? `${count} giờ trước`
        : `${count}h ago`;
  }
  const days = Math.floor(diffSec / 86400);
  if (days < 7) {
    return t
      ? t('cinebot.daysAgo', { count: days })
      : lang === 'vi'
        ? `${days} ngày trước`
        : `${days}d ago`;
  }
  return new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(timestamp));
}

export function formatExactTime(isoDate?: string | null, lang: 'en' | 'vi' = 'en'): string {
  if (!isoDate) {
    return '';
  }
  const timestamp = Date.parse(isoDate);
  if (Number.isNaN(timestamp)) {
    return '';
  }
  return new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp));
}
