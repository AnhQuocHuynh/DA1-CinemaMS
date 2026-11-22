import { KeyboardEvent, RefObject, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage, ChatSessionSummary } from '../../services/chatbotApi';
import { ChatHeader } from './ChatHeader';
import { Composer } from './Composer';
import { ConversationDropdown } from './ConversationDropdown';
import { MessageList } from './MessageList';
import { useCinebotTranslation } from './useCinebotTranslation';
import type { MessageFeedback } from './types';

interface ChatWindowProps {
  isOpen: boolean;
  isExpanded: boolean;
  isAuthenticated: boolean;
  sessions: ChatSessionSummary[];
  activeId: string | null;
  messages: ChatMessage[];
  draft: string;
  maxLength: number;
  sending: boolean;
  loadingMessages: boolean;
  error: string;
  canRetry: boolean;
  lang: 'en' | 'vi';
  feedbackByMessage: Record<string, MessageFeedback>;
  scrollTrigger: number;
  launcherRef: RefObject<HTMLButtonElement>;
  onClose: () => void;
  onToggleExpand: () => void;
  onNewChat: () => void;
  onSelectSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, title: string) => Promise<boolean>;
  onDeleteSession: (sessionId: string) => Promise<boolean>;
  onClearGuest: () => void;
  onSignIn: () => void;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  onSelectPrompt: (prompt: string) => void;
  onRegenerate: () => void;
  onFeedback: (messageId: string | number, value: MessageFeedback) => void;
  onRetry: () => void;
}

export function ChatWindow({
  isOpen,
  isExpanded,
  isAuthenticated,
  sessions,
  activeId,
  messages,
  draft,
  maxLength,
  sending,
  loadingMessages,
  error,
  canRetry,
  lang,
  feedbackByMessage,
  scrollTrigger,
  launcherRef,
  onClose,
  onToggleExpand,
  onNewChat,
  onSelectSession,
  onRenameSession,
  onDeleteSession,
  onClearGuest,
  onSignIn,
  onDraftChange,
  onSend,
  onStop,
  onSelectPrompt,
  onRegenerate,
  onFeedback,
  onRetry,
}: ChatWindowProps) {
  const { t } = useCinebotTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const historyButtonRef = useRef<HTMLButtonElement>(null);
  const titleButtonRef = useRef<HTMLButtonElement>(null);

  const [shouldRender, setShouldRender] = useState(isOpen);
  const [animateOpen, setAnimateOpen] = useState(isOpen);
  const [historyOpen, setHistoryOpen] = useState(false);

  const activeTitle = useMemo(() => {
    const active = sessions.find((s) => s.id === activeId);
    return active?.title ?? null;
  }, [sessions, activeId]);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      let raf2 = 0;
      const raf1 = window.requestAnimationFrame(() => {
        raf2 = window.requestAnimationFrame(() => {
          setAnimateOpen(true);
        });
      });
      const focusTimer = window.setTimeout(() => {
        textareaRef.current?.focus();
      }, 60);
      return () => {
        window.cancelAnimationFrame(raf1);
        window.cancelAnimationFrame(raf2);
        window.clearTimeout(focusTimer);
      };
    }

    setAnimateOpen(false);
    setHistoryOpen(false);
    const reducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const closeTimer = window.setTimeout(
      () => setShouldRender(false),
      reducedMotion ? 0 : 190,
    );
    return () => window.clearTimeout(closeTimer);
  }, [isOpen]);

  useEffect(() => {
    if (isExpanded) {
      setHistoryOpen(false);
    }
  }, [isExpanded]);

  if (!shouldRender) {
    return null;
  }

  function closeDialogAndReturnFocus() {
    setHistoryOpen(false);
    onClose();
    window.setTimeout(() => {
      launcherRef.current?.focus();
    }, 0);
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (historyOpen) {
        setHistoryOpen(false);
        historyButtonRef.current?.focus();
        return;
      }
      closeDialogAndReturnFocus();
      return;
    }

    if (event.key === 'Tab' && dialogRef.current) {
      const focusables = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

      if (focusables.length === 0) {
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  const desktopDimensions = isExpanded
    ? 'sm:w-[min(720px,calc(100vw-2.5rem))] sm:h-[min(80vh,calc(100vh-100px))]'
    : 'sm:w-[420px] sm:h-[min(640px,calc(100vh-100px))] sm:max-w-[calc(100vw-2.5rem)]';

  return (
    <div
      ref={dialogRef}
      id="cinebot-dialog"
      role="dialog"
      aria-label={t('cinebot.dialogLabel')}
      onKeyDown={handleDialogKeyDown}
      className={`cinebot-popover fixed inset-0 z-[65] flex h-[100dvh] w-full flex-col overflow-hidden bg-surface/95 text-on-surface shadow-2xl backdrop-blur-xl dark:bg-surface-container-lowest/95 sm:inset-auto sm:bottom-[76px] sm:right-5 sm:z-[59] sm:rounded-2xl sm:border sm:border-outline-variant/90 ${desktopDimensions} ${
        animateOpen ? 'cinebot-popover-open' : 'cinebot-popover-closed'
      }`}
    >
      <div className="relative">
        <ChatHeader
          isAuthenticated={isAuthenticated}
          isExpanded={isExpanded}
          historyOpen={historyOpen}
          activeTitle={activeTitle}
          hasMessages={messages.length > 0}
          onNewChat={() => {
            setHistoryOpen(false);
            onNewChat();
            textareaRef.current?.focus();
          }}
          onToggleHistory={() => setHistoryOpen((open) => !open)}
          onToggleExpand={onToggleExpand}
          onClearGuest={() => {
            onClearGuest();
            textareaRef.current?.focus();
          }}
          onSignIn={onSignIn}
          onClose={closeDialogAndReturnFocus}
          historyButtonRef={historyButtonRef}
          titleButtonRef={titleButtonRef}
        />

        {isAuthenticated && historyOpen && (
          <ConversationDropdown
            variant="dropdown"
            sessions={sessions}
            activeId={activeId}
            onSelect={(id) => {
              onSelectSession(id);
              textareaRef.current?.focus();
            }}
            onCreate={() => {
              setHistoryOpen(false);
              onNewChat();
            }}
            onRename={onRenameSession}
            onDelete={onDeleteSession}
            onClose={() => setHistoryOpen(false)}
            ignoreOutsideRefs={[historyButtonRef, titleButtonRef]}
          />
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        {isAuthenticated && isExpanded && (
          <ConversationDropdown
            variant="sidebar"
            sessions={sessions}
            activeId={activeId}
            onSelect={(id) => {
              onSelectSession(id);
              textareaRef.current?.focus();
            }}
            onCreate={onNewChat}
            onRename={onRenameSession}
            onDelete={onDeleteSession}
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <MessageList
            messages={messages}
            lang={lang}
            sending={sending}
            loadingMessages={loadingMessages}
            error={error}
            canRetry={canRetry}
            isAuthenticated={isAuthenticated}
            feedbackByMessage={feedbackByMessage}
            scrollTrigger={scrollTrigger}
            onSelectPrompt={onSelectPrompt}
            onRegenerate={onRegenerate}
            onFeedback={onFeedback}
            onRetry={onRetry}
          />

          <Composer
            draft={draft}
            maxLength={maxLength}
            sending={sending}
            isAuthenticated={isAuthenticated}
            textareaRef={textareaRef}
            onChange={onDraftChange}
            onSend={onSend}
            onStop={onStop}
          />
        </div>
      </div>
    </div>
  );
}
