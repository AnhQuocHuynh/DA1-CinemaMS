import { describe, expect, it } from 'vitest';
import {
  formatRelativeTime,
  groupSessionsByDate,
  parseMessageTicketSegments,
} from '../../utils/chatTicketParser';

describe('parseMessageTicketSegments', () => {
  it('parses Vietnamese pipe-delimited backend order formatting', () => {
    const input = [
      'Đơn đặt vé của bạn:',
      '- Đơn #29: Upcoming Movie (2026-11-21 19:30) | CGV HUNG VUONG PLAZA - Phòng A3 | Ghế: A1, A2 | Trạng thái: CONFIRMED | Tổng: 180000',
    ].join('\n');

    const segments = parseMessageTicketSegments(input);
    expect(segments).toHaveLength(2);
    expect(segments[0]).toEqual({ type: 'markdown', content: 'Đơn đặt vé của bạn:' });
    expect(segments[1]).toEqual({
      type: 'tickets',
      tickets: [
        {
          orderId: '29',
          movieTitle: 'Upcoming Movie',
          dateTime: '2026-11-21 19:30',
          theater: 'CGV HUNG VUONG PLAZA',
          room: 'Phòng A3',
          seats: 'A1, A2',
          status: 'CONFIRMED',
          total: '180000',
        },
      ],
    });
  });

  it('parses English pipe-delimited order formatting with underscored status', () => {
    const input =
      '- Order #42: Dune Part Two (2026-11-22 20:00) | Galaxy Nguyen Du - Room 4 | Seats: D5, D6 | Status: AWAITING_PAYMENT | Total: 220000';

    const segments = parseMessageTicketSegments(input);
    expect(segments).toEqual([
      {
        type: 'tickets',
        tickets: [
          {
            orderId: '42',
            movieTitle: 'Dune Part Two',
            dateTime: '2026-11-22 20:00',
            theater: 'Galaxy Nguyen Du',
            room: 'Room 4',
            seats: 'D5, D6',
            status: 'AWAITING_PAYMENT',
            total: '220000',
          },
        ],
      },
    ]);
  });

  it('parses LLM single-line bold markdown tickets', () => {
    const input =
      '- **Đơn #29:** Upcoming Movie — CGV HUNG VUONG PLAZA, Phòng A3, Ghế A1, A2, Trạng thái: CONFIRMED';

    const segments = parseMessageTicketSegments(input);
    expect(segments).toEqual([
      {
        type: 'tickets',
        tickets: [
          {
            orderId: '29',
            movieTitle: 'Upcoming Movie',
            theater: 'CGV HUNG VUONG PLAZA',
            room: 'Phòng A3',
            seats: 'A1, A2',
            status: 'CONFIRMED',
          },
        ],
      },
    ]);
  });

  it('parses LLM multi-line bulleted ticket details and preserves surrounding text', () => {
    const input = [
      'Dưới đây là thông tin vé của bạn:',
      '',
      '- **Đơn #29:** Upcoming Movie',
      '  - Rạp: CGV HUNG VUONG PLAZA',
      '  - Phòng: Phòng A3',
      '  - Suất chiếu: 21/11/2026 19:30',
      '  - Ghế: A1, A2',
      '  - Trạng thái: CONFIRMED',
      '',
      'Chúc bạn xem phim vui vẻ!',
    ].join('\n');

    const segments = parseMessageTicketSegments(input);
    expect(segments).toEqual([
      { type: 'markdown', content: 'Dưới đây là thông tin vé của bạn:' },
      {
        type: 'tickets',
        tickets: [
          {
            orderId: '29',
            movieTitle: 'Upcoming Movie',
            theater: 'CGV HUNG VUONG PLAZA',
            room: 'Phòng A3',
            dateTime: '21/11/2026 19:30',
            seats: 'A1, A2',
            status: 'CONFIRMED',
          },
        ],
      },
      { type: 'markdown', content: 'Chúc bạn xem phim vui vẻ!' },
    ]);
  });

  it('does not misclassify ordinary movie or policy markdown as ticket cards', () => {
    const input = [
      '**Today showtimes:**',
      '- Dune: Part Two at 19:30 (IMAX)',
      '- Refund policy: Cancel up to 60 minutes before showtime.',
      'Đơn #29 đã được xử lý.',
    ].join('\n');

    const segments = parseMessageTicketSegments(input);
    expect(segments).toHaveLength(1);
    expect(segments[0].type).toBe('markdown');
  });
});

describe('groupSessionsByDate & formatRelativeTime', () => {
  it('groups sessions into today, yesterday, previous7Days, and older', () => {
    const now = new Date('2026-11-21T14:00:00');
    const grouped = groupSessionsByDate(
      [
        { id: 'older', title: 'Old', updatedAt: '2026-11-01T10:00:00' },
        { id: 'today', title: 'Today', updatedAt: '2026-11-21T12:00:00' },
        { id: 'week', title: 'Week', updatedAt: '2026-11-17T10:00:00' },
        { id: 'yesterday', title: 'Yesterday', updatedAt: '2026-11-20T18:00:00' },
      ],
      now,
    );

    expect(grouped.map((g) => g.key)).toEqual([
      'today',
      'yesterday',
      'previous7Days',
      'older',
    ]);
    expect(grouped[0].sessions[0].id).toBe('today');
    expect(grouped[1].sessions[0].id).toBe('yesterday');
    expect(grouped[2].sessions[0].id).toBe('week');
    expect(grouped[3].sessions[0].id).toBe('older');
  });

  it('formats relative time in EN and VI', () => {
    const now = new Date('2026-11-21T14:00:00Z');
    expect(formatRelativeTime('2026-11-21T13:59:30Z', 'en', undefined, now)).toBe('Just now');
    expect(formatRelativeTime('2026-11-21T13:55:00Z', 'vi', undefined, now)).toBe('5 phút trước');
    expect(formatRelativeTime('2026-11-21T11:00:00Z', 'en', undefined, now)).toBe('3h ago');
  });
});
