import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export const CINEBOT_FALLBACK_EN = {
  launcherLabel: 'CineBot',
  openAssistant: 'Open CineBot assistant',
  closeAssistant: 'Close CineBot assistant',
  minimizeAssistant: 'Minimize CineBot',
  firstVisitTooltip: 'Ask me anything',
  dismissTooltip: 'Dismiss tip',
  name: 'CineBot',
  dialogLabel: 'CineBot AI Assistant',
  online: 'Online',
  guestBadge: 'Guest FAQ',
  newChat: 'New chat',
  history: 'History',
  expand: 'Expand view',
  collapse: 'Compact view',
  clearChat: 'Clear',
  signIn: 'Sign in',
  untitledChat: 'New conversation',
  searchPlaceholder: 'Search conversations...',
  clearSearch: 'Clear search',
  noConversations: 'No conversations yet',
  noSearchResults: 'No matching conversations',
  loadingMessages: 'Loading conversation...',
  groups: {
    today: 'Today',
    yesterday: 'Yesterday',
    previous7Days: 'Previous 7 days',
    older: 'Older',
  },
  rename: 'Rename',
  delete: 'Delete',
  deleteConfirmPrompt: 'Delete?',
  confirmDelete: 'Confirm delete',
  cancel: 'Cancel',
  save: 'Save',
  renameInputLabel: 'Edit conversation title',
  greetingTitle: "Hi, I'm CineBot 👋",
  greetingSubtitle: 'How can I help you today?',
  guestSubtitle:
    'Ask cinema FAQs in guest mode, or sign in for movies, showtimes, and your tickets.',
  suggestions: {
    showtimes: {
      label: "Today's showtimes",
      prompt: 'What movies are showing today?',
    },
    tickets: {
      label: 'My tickets',
      prompt: 'Show my tickets and orders',
    },
    refund: {
      label: 'Refund policy',
      prompt: 'What is the ticket cancellation and refund policy?',
    },
    rental: {
      label: 'Room rental',
      prompt: 'How does private screening room rental work?',
    },
  },
  guestSuggestions: {
    refund: {
      label: 'Refund policy',
      prompt: 'What is the ticket cancellation and refund policy?',
    },
    seats: {
      label: 'Seat classes & rooms',
      prompt: 'What seat classes and screening room types are available?',
    },
    payment: {
      label: 'Payment methods',
      prompt: 'What payment methods are accepted and how long are seats held?',
    },
    ratings: {
      label: 'Age ratings',
      prompt: 'What do the movie age ratings P, K, T13, T16, T18, and C mean?',
    },
  },
  thinking: 'Thinking...',
  copy: 'Copy',
  copied: 'Copied',
  regenerate: 'Regenerate',
  helpful: 'Helpful',
  notHelpful: 'Not helpful',
  sources: 'Sources',
  jumpToLatest: 'Jump to latest',
  retry: 'Retry',
  stopped: 'Generation stopped',
  justNow: 'Just now',
  minutesAgo: '{{count}}m ago',
  hoursAgo: '{{count}}h ago',
  daysAgo: '{{count}}d ago',
  ticket: {
    orderNumber: 'Order #{{id}}',
    theater: 'Theater',
    room: 'Room',
    seats: 'Seats',
    showtime: 'Showtime',
    total: 'Total',
    viewMyTickets: 'View in My Tickets',
    status: {
      CONFIRMED: 'Confirmed',
      PAID: 'Paid',
      COMPLETED: 'Completed',
      PENDING: 'Pending',
      AWAITING_PAYMENT: 'Awaiting Payment',
      CANCELLED: 'Cancelled',
      REFUNDED: 'Refunded',
      EXPIRED: 'Expired',
      FAILED: 'Failed',
      UNKNOWN: 'Unknown',
    },
  },
  placeholder: 'Ask about movies, showtimes, or orders…',
  placeholderShort: 'Ask CineBot…',
  guestPlaceholder: 'Ask a cinema FAQ (refunds, seats, payments)…',
  messageInputLabel: 'Message CineBot',
  send: 'Send message',
  stop: 'Stop generating',
  disclaimer: 'CineBot can make mistakes. Check important info.',
  errors: {
    connect: 'Unable to connect to CineBot assistant.',
    loadMessages: 'Unable to load conversation messages.',
    createSession: 'Unable to create conversation.',
    renameEmpty: 'Conversation title cannot be blank.',
    renameFailed: 'Unable to rename conversation.',
    deleteFailed: 'Unable to delete conversation.',
    sendFailed: 'Unable to reach CineBot right now.',
  },
} as const;

export const CINEBOT_FALLBACK_VI = {
  launcherLabel: 'CineBot',
  openAssistant: 'Mở trợ lý CineBot',
  closeAssistant: 'Đóng trợ lý CineBot',
  minimizeAssistant: 'Thu nhỏ CineBot',
  firstVisitTooltip: 'Hỏi tôi bất cứ điều gì',
  dismissTooltip: 'Ẩn gợi ý',
  name: 'CineBot',
  dialogLabel: 'Trợ lý AI CineBot',
  online: 'Trực tuyến',
  guestBadge: 'FAQ Khách',
  newChat: 'Đoạn chat mới',
  history: 'Lịch sử',
  expand: 'Mở rộng',
  collapse: 'Thu gọn',
  clearChat: 'Xóa',
  signIn: 'Đăng nhập',
  untitledChat: 'Cuộc trò chuyện mới',
  searchPlaceholder: 'Tìm cuộc trò chuyện...',
  clearSearch: 'Xóa tìm kiếm',
  noConversations: 'Chưa có cuộc trò chuyện nào',
  noSearchResults: 'Không tìm thấy cuộc trò chuyện phù hợp',
  loadingMessages: 'Đang tải cuộc trò chuyện...',
  groups: {
    today: 'Hôm nay',
    yesterday: 'Hôm qua',
    previous7Days: '7 ngày trước',
    older: 'Cũ hơn',
  },
  rename: 'Đổi tên',
  delete: 'Xóa',
  deleteConfirmPrompt: 'Xóa?',
  confirmDelete: 'Xác nhận xóa',
  cancel: 'Hủy',
  save: 'Lưu',
  renameInputLabel: 'Chỉnh sửa tiêu đề cuộc trò chuyện',
  greetingTitle: 'Xin chào, tôi là CineBot 👋',
  greetingSubtitle: 'Hôm nay tôi có thể giúp gì cho bạn?',
  guestSubtitle:
    'Hỏi câu hỏi thường gặp ở chế độ khách, hoặc đăng nhập để xem phim, lịch chiếu và vé của bạn.',
  suggestions: {
    showtimes: {
      label: 'Lịch chiếu hôm nay',
      prompt: 'Lịch chiếu phim hôm nay có những suất nào?',
    },
    tickets: {
      label: 'Vé của tôi',
      prompt: 'Xem vé của tôi và đơn đặt vé',
    },
    refund: {
      label: 'Chính sách hoàn vé',
      prompt: 'Chính sách hủy và hoàn vé như thế nào?',
    },
    rental: {
      label: 'Thuê phòng chiếu',
      prompt: 'Chính sách và cách thuê phòng chiếu riêng như thế nào?',
    },
  },
  guestSuggestions: {
    refund: {
      label: 'Chính sách hoàn vé',
      prompt: 'Chính sách hủy và hoàn vé như thế nào?',
    },
    seats: {
      label: 'Loại ghế & phòng chiếu',
      prompt: 'Rạp có những loại ghế và phòng chiếu nào?',
    },
    payment: {
      label: 'Phương thức thanh toán',
      prompt: 'Rạp chấp nhận những phương thức thanh toán nào?',
    },
    ratings: {
      label: 'Phân loại độ tuổi',
      prompt: 'Ý nghĩa phân loại độ tuổi P, K, T13, T16, T18 và C là gì?',
    },
  },
  thinking: 'Đang suy nghĩ...',
  copy: 'Sao chép',
  copied: 'Đã sao chép',
  regenerate: 'Tạo lại',
  helpful: 'Hữu ích',
  notHelpful: 'Chưa hữu ích',
  sources: 'Nguồn',
  jumpToLatest: 'Xuống tin mới nhất',
  retry: 'Thử lại',
  stopped: 'Đã dừng phản hồi',
  justNow: 'Vừa xong',
  minutesAgo: '{{count}} phút trước',
  hoursAgo: '{{count}} giờ trước',
  daysAgo: '{{count}} ngày trước',
  ticket: {
    orderNumber: 'Đơn #{{id}}',
    theater: 'Rạp',
    room: 'Phòng',
    seats: 'Ghế',
    showtime: 'Suất chiếu',
    total: 'Tổng tiền',
    viewMyTickets: 'Xem trong Vé của tôi',
    status: {
      CONFIRMED: 'Đã xác nhận',
      PAID: 'Đã thanh toán',
      COMPLETED: 'Hoàn tất',
      PENDING: 'Đang chờ',
      AWAITING_PAYMENT: 'Chờ thanh toán',
      CANCELLED: 'Đã hủy',
      REFUNDED: 'Đã hoàn tiền',
      EXPIRED: 'Hết hạn',
      FAILED: 'Thất bại',
      UNKNOWN: 'Không rõ',
    },
  },
  placeholder: 'Hỏi về phim, lịch chiếu hoặc đơn vé…',
  placeholderShort: 'Hỏi CineBot…',
  guestPlaceholder: 'Hỏi câu hỏi thường gặp về rạp…',
  messageInputLabel: 'Nhắn tin cho CineBot',
  send: 'Gửi tin nhắn',
  stop: 'Dừng tạo phản hồi',
  disclaimer: 'CineBot có thể mắc lỗi. Hãy kiểm tra thông tin quan trọng.',
  errors: {
    connect: 'Không thể kết nối trợ lý CineBot.',
    loadMessages: 'Không thể tải tin nhắn cuộc trò chuyện.',
    createSession: 'Không thể tạo cuộc trò chuyện.',
    renameEmpty: 'Tiêu đề cuộc trò chuyện không được để trống.',
    renameFailed: 'Không thể đổi tên cuộc trò chuyện.',
    deleteFailed: 'Không thể xóa cuộc trò chuyện.',
    sendFailed: 'Không thể kết nối tới CineBot lúc này.',
  },
} as const;

export type CinebotTFunction = (
  key: string,
  options?: Record<string, unknown>,
) => string;

let reloadAttempted = false;

export function getCinebotFallback(key: string, lang: 'en' | 'vi'): string | undefined {
  if (!key.startsWith('cinebot.')) {
    return undefined;
  }
  const parts = key.slice('cinebot.'.length).split('.');
  let current: unknown = lang === 'vi' ? CINEBOT_FALLBACK_VI : CINEBOT_FALLBACK_EN;
  for (const part of parts) {
    if (!current || typeof current !== 'object' || !(part in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : undefined;
}

export function useCinebotTranslation() {
  const { t: rawT, i18n } = useTranslation();
  const lang: 'en' | 'vi' = i18n.language?.toLowerCase().startsWith('vi') ? 'vi' : 'en';

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      !reloadAttempted &&
      i18n.isInitialized &&
      !i18n.exists('cinebot.name') &&
      typeof i18n.reloadResources === 'function'
    ) {
      reloadAttempted = true;
      void i18n.reloadResources(['en', 'vi'], ['translation']).catch(() => {});
    }
  }, [i18n, lang]);

  const t = useCallback<CinebotTFunction>(
    (key, options) => {
      const explicitDefault =
        options && typeof options.defaultValue === 'string'
          ? options.defaultValue
          : undefined;
      const fallback = getCinebotFallback(key, lang) ?? explicitDefault;
      if (fallback !== undefined) {
        return rawT(key, { ...options, defaultValue: fallback });
      }
      return rawT(key, options);
    },
    [rawT, lang],
  );

  return { t, i18n, lang };
}
