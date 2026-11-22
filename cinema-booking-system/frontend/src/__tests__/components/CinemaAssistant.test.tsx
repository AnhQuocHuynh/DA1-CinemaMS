import fs from 'node:fs';
import path from 'node:path';
import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import i18next from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { describe, expect, it, vi } from 'vitest';
import { ChatHeader } from '../../components/chat/ChatHeader';
import { ChatLauncher } from '../../components/chat/ChatLauncher';
import { ChatWindow } from '../../components/chat/ChatWindow';
import { ConversationDropdown } from '../../components/chat/ConversationDropdown';
import { MessageBubble } from '../../components/chat/MessageBubble';
import {
  CINEBOT_FALLBACK_EN,
  CINEBOT_FALLBACK_VI,
} from '../../components/chat/useCinebotTranslation';

const enTranslations = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../../public/locales/en/translation.json'),
    'utf8',
  ),
);
const viTranslations = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../../public/locales/vi/translation.json'),
    'utf8',
  ),
);

async function createTestI18n(lng: 'en' | 'vi') {
  const instance = i18next.createInstance();
  await instance.use(initReactI18next).init({
    lng,
    fallbackLng: 'en',
    resources: {
      en: { translation: enTranslations },
      vi: { translation: viTranslations },
    },
    interpolation: { escapeValue: false },
  });
  return instance;
}

async function createEmptyBundleI18n(lng: 'en' | 'vi') {
  const instance = i18next.createInstance();
  await instance.use(initReactI18next).init({
    lng,
    fallbackLng: 'en',
    resources: {
      en: { translation: {} },
      vi: { translation: {} },
    },
    interpolation: { escapeValue: false },
  });
  return instance;
}

async function renderWithProviders(
  ui: JSX.Element,
  lng: 'en' | 'vi' = 'en',
  useEmptyBundle = false,
): Promise<string> {
  const i18n = useEmptyBundle ? await createEmptyBundleI18n(lng) : await createTestI18n(lng);
  return renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>{ui}</MemoryRouter>
    </I18nextProvider>,
  );
}

describe('CineBot redesigned UI components', () => {
  it('keeps fallback translations in exact sync with public locale JSON files', () => {
    expect(CINEBOT_FALLBACK_EN).toEqual(enTranslations.cinebot);
    expect(CINEBOT_FALLBACK_VI).toEqual(viTranslations.cinebot);
  });

  it('renders localized labels cleanly even when HTTP translation bundles are stale or empty', async () => {
    const btnRef = createRef<HTMLButtonElement>();
    const launcherHtml = await renderWithProviders(
      <ChatLauncher
        isOpen={false}
        hasVisited={false}
        onToggle={vi.fn()}
        onDismissTooltip={vi.fn()}
        buttonRef={btnRef}
      />,
      'en',
      true,
    );
    expect(launcherHtml).toContain('CineBot');
    expect(launcherHtml).toContain('Ask me anything');
    expect(launcherHtml).not.toContain('cinebot.launcherLabel');
    expect(launcherHtml).not.toContain('cinebot.firstVisitTooltip');

    const headerEnHtml = await renderWithProviders(
      <ChatHeader
        isAuthenticated={true}
        isExpanded={false}
        historyOpen={false}
        activeTitle={null}
        hasMessages={false}
        onNewChat={vi.fn()}
        onToggleHistory={vi.fn()}
        onToggleExpand={vi.fn()}
        onClearGuest={vi.fn()}
        onSignIn={vi.fn()}
        onClose={vi.fn()}
        historyButtonRef={btnRef}
        titleButtonRef={btnRef}
      />,
      'en',
      true,
    );
    expect(headerEnHtml).toContain('CineBot');
    expect(headerEnHtml).toContain('Online');
    expect(headerEnHtml).toContain('New conversation');
    expect(headerEnHtml).not.toContain('cinebot.name');
    expect(headerEnHtml).not.toContain('cinebot.online');

    const headerViHtml = await renderWithProviders(
      <ChatHeader
        isAuthenticated={true}
        isExpanded={false}
        historyOpen={false}
        activeTitle={null}
        hasMessages={false}
        onNewChat={vi.fn()}
        onToggleHistory={vi.fn()}
        onToggleExpand={vi.fn()}
        onClearGuest={vi.fn()}
        onSignIn={vi.fn()}
        onClose={vi.fn()}
        historyButtonRef={btnRef}
        titleButtonRef={btnRef}
      />,
      'vi',
      true,
    );
    expect(headerViHtml).toContain('CineBot');
    expect(headerViHtml).toContain('Trực tuyến');
    expect(headerViHtml).toContain('Cuộc trò chuyện mới');
    expect(headerViHtml).not.toContain('cinebot.name');
    expect(headerViHtml).not.toContain('cinebot.online');
  });
  it('renders ChatLauncher collapsed pill with first-visit tooltip and morphs when open', async () => {
    const ref = createRef<HTMLButtonElement>();

    const firstVisitHtml = await renderWithProviders(
      <ChatLauncher
        isOpen={false}
        hasVisited={false}
        onToggle={vi.fn()}
        onDismissTooltip={vi.fn()}
        buttonRef={ref}
      />,
      'en',
    );
    expect(firstVisitHtml).toContain('CineBot');
    expect(firstVisitHtml).toContain('Ask me anything');
    expect(firstVisitHtml).toContain('aria-expanded="false"');

    const firstVisitViHtml = await renderWithProviders(
      <ChatLauncher
        isOpen={false}
        hasVisited={false}
        onToggle={vi.fn()}
        onDismissTooltip={vi.fn()}
        buttonRef={ref}
      />,
      'vi',
    );
    expect(firstVisitViHtml).toContain('Hỏi tôi bất cứ điều gì');

    const revisitedHtml = await renderWithProviders(
      <ChatLauncher
        isOpen={false}
        hasVisited={true}
        onToggle={vi.fn()}
        onDismissTooltip={vi.fn()}
        buttonRef={ref}
      />,
      'en',
    );
    expect(revisitedHtml).not.toContain('Ask me anything');

    const openHtml = await renderWithProviders(
      <ChatLauncher
        isOpen={true}
        hasVisited={true}
        onToggle={vi.fn()}
        onDismissTooltip={vi.fn()}
        buttonRef={ref}
      />,
      'en',
    );
    expect(openHtml).toContain('aria-expanded="true"');
    expect(openHtml).toContain('lucide-chevron-down');
    expect(openHtml).not.toMatch(/>[^<]*Close CineBot/);
  });

  it('renders ChatWindow ARIA roles, empty-state chips, placeholder, and disclaimer in EN and VI', async () => {
    const launcherRef = createRef<HTMLButtonElement>();
    const baseProps = {
      isOpen: true,
      isExpanded: false,
      isAuthenticated: true,
      sessions: [{ id: 's-1', title: 'Movie chat', updatedAt: new Date().toISOString() }],
      activeId: 's-1',
      messages: [],
      draft: '',
      maxLength: 500,
      sending: false,
      loadingMessages: false,
      error: '',
      canRetry: false,
      feedbackByMessage: {},
      scrollTrigger: 0,
      launcherRef,
      onClose: vi.fn(),
      onToggleExpand: vi.fn(),
      onNewChat: vi.fn(),
      onSelectSession: vi.fn(),
      onRenameSession: vi.fn().mockResolvedValue(true),
      onDeleteSession: vi.fn().mockResolvedValue(true),
      onClearGuest: vi.fn(),
      onSignIn: vi.fn(),
      onDraftChange: vi.fn(),
      onSend: vi.fn(),
      onStop: vi.fn(),
      onSelectPrompt: vi.fn(),
      onRegenerate: vi.fn(),
      onFeedback: vi.fn(),
      onRetry: vi.fn(),
    };

    const enHtml = await renderWithProviders(<ChatWindow {...baseProps} lang="en" />, 'en');
    expect(enHtml).toContain('role="dialog"');
    expect(enHtml).toContain('role="log"');
    expect(enHtml).toContain('aria-live="polite"');
    expect(enHtml).toContain("Hi, I&#x27;m CineBot 👋");
    expect(enHtml).toContain("Today&#x27;s showtimes");
    expect(enHtml).toContain('My tickets');
    expect(enHtml).toContain('Refund policy');
    expect(enHtml).toContain('Room rental');
    expect(enHtml).toContain('Ask about movies, showtimes, or orders…');
    expect(enHtml).toContain('CineBot can make mistakes. Check important info.');
    expect(enHtml).toContain('Online');

    const viHtml = await renderWithProviders(<ChatWindow {...baseProps} lang="vi" />, 'vi');
    expect(viHtml).toContain('Xin chào, tôi là CineBot 👋');
    expect(viHtml).toContain('Lịch chiếu hôm nay');
    expect(viHtml).toContain('Vé của tôi');
    expect(viHtml).toContain('Chính sách hoàn vé');
    expect(viHtml).toContain('Thuê phòng chiếu');
    expect(viHtml).toContain('Hỏi về phim, lịch chiếu hoặc đơn vé…');
    expect(viHtml).toContain('CineBot có thể mắc lỗi. Hãy kiểm tra thông tin quan trọng.');
    expect(viHtml).toContain('Trực tuyến');

    const expandedHtml = await renderWithProviders(
      <ChatWindow {...baseProps} isExpanded={true} lang="en" />,
      'en',
    );
    expect(expandedHtml).toContain('role="listbox"');
    expect(expandedHtml).toContain('sm:w-[min(720px,calc(100vw-2.5rem))]');
  });

  it('renders ConversationDropdown with listbox/group/option semantics and date buckets', async () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const twentyDaysAgo = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);

    const html = await renderWithProviders(
      <ConversationDropdown
        variant="dropdown"
        sessions={[
          { id: '1', title: 'Today Chat', updatedAt: now.toISOString() },
          { id: '2', title: 'Yesterday Chat', updatedAt: yesterday.toISOString() },
          { id: '3', title: 'Week Chat', updatedAt: threeDaysAgo.toISOString() },
          { id: '4', title: 'Old Chat', updatedAt: twentyDaysAgo.toISOString() },
        ]}
        activeId="1"
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onRename={vi.fn().mockResolvedValue(true)}
        onDelete={vi.fn().mockResolvedValue(true)}
        onClose={vi.fn()}
      />,
      'en',
    );

    expect(html).toContain('role="listbox"');
    expect(html).toContain('role="group"');
    expect(html).toContain('role="option"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('Today');
    expect(html).toContain('Yesterday');
    expect(html).toContain('Previous 7 days');
    expect(html).toContain('Older');
  });

  it('renders sanitized Markdown, structured TicketCards, typing dots, and message actions', async () => {
    const mdAndTicketHtml = await renderWithProviders(
      <MessageBubble
        message={{
          id: 'm-1',
          role: 'assistant',
          content: [
            '**Showtimes** and [Browse](/movies)',
            '',
            '- Item one',
            '- Item two',
            '',
            '| Seat | Price |',
            '| --- | --- |',
            '| VIP | 120k |',
            '',
            '<script>alert(1)</script>',
            '[bad](javascript:alert(1))',
            '',
            '- **Đơn #29:** Upcoming Movie — CGV HUNG VUONG PLAZA, Phòng A3, Ghế A1, A2, Trạng thái: CONFIRMED',
          ].join('\n'),
          createdAt: new Date().toISOString(),
          suggestedFollowUps: ['Follow-up A', 'Follow-up B'],
        }}
        lang="vi"
        isStreaming={false}
        isLastAssistant={true}
        isSending={false}
        feedback="up"
        onRegenerate={vi.fn()}
        onFeedback={vi.fn()}
        onSelectFollowUp={vi.fn()}
      />,
      'vi',
    );

    expect(mdAndTicketHtml).toContain('<strong');
    expect(mdAndTicketHtml).toContain('<ul');
    expect(mdAndTicketHtml).toContain('<table');
    expect(mdAndTicketHtml).toContain('href="/movies"');
    expect(mdAndTicketHtml).not.toContain('<script>');
    expect(mdAndTicketHtml).not.toContain('href="javascript:');
    expect(mdAndTicketHtml).toContain('Đơn #29');
    expect(mdAndTicketHtml).toContain('Upcoming Movie');
    expect(mdAndTicketHtml).toContain('CGV HUNG VUONG PLAZA');
    expect(mdAndTicketHtml).toContain('Phòng A3');
    expect(mdAndTicketHtml).toContain('A1');
    expect(mdAndTicketHtml).toContain('A2');
    expect(mdAndTicketHtml).toContain('Đã xác nhận');
    expect(mdAndTicketHtml).toContain('aria-pressed="true"');
    expect(mdAndTicketHtml).toContain('Tạo lại');
    expect(mdAndTicketHtml).toContain('Follow-up A');

    const thinkingHtml = await renderWithProviders(
      <MessageBubble
        message={{
          id: 'm-2',
          role: 'assistant',
          content: '',
          createdAt: new Date().toISOString(),
        }}
        lang="en"
        isStreaming={true}
        isLastAssistant={true}
        isSending={true}
        onRegenerate={vi.fn()}
        onFeedback={vi.fn()}
        onSelectFollowUp={vi.fn()}
      />,
      'en',
    );
    expect(thinkingHtml).toContain('cinebot-typing-dot');
    expect(thinkingHtml).toContain('Thinking...');
    expect(thinkingHtml).not.toContain('Regenerate');
  });
});
