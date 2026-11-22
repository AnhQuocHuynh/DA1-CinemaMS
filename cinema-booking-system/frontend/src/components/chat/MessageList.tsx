import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowDown, RefreshCw } from 'lucide-react';
import type { ChatMessage } from '../../services/chatbotApi';
import { MessageBubble } from './MessageBubble';
import { SuggestionChips } from './SuggestionChips';
import { useCinebotTranslation } from './useCinebotTranslation';
import type { MessageFeedback } from './types';

interface MessageListProps {
  messages: ChatMessage[];
  lang: 'en' | 'vi';
  sending: boolean;
  loadingMessages: boolean;
  error: string;
  canRetry: boolean;
  isAuthenticated: boolean;
  feedbackByMessage: Record<string, MessageFeedback>;
  scrollTrigger: number;
  onSelectPrompt: (prompt: string) => void;
  onRegenerate: () => void;
  onFeedback: (messageId: string | number, value: MessageFeedback) => void;
  onRetry: () => void;
}

export function MessageList({
  messages,
  lang,
  sending,
  loadingMessages,
  error,
  canRetry,
  isAuthenticated,
  feedbackByMessage,
  scrollTrigger,
  onSelectPrompt,
  onRegenerate,
  onFeedback,
  onRetry,
}: MessageListProps) {
  const { t } = useCinebotTranslation();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const lastAssistantIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'assistant') {
        return i;
      }
    }
    return -1;
  })();

  function scrollToBottom(smooth: boolean) {
    const el = scrollContainerRef.current;
    if (!el) {
      return;
    }
    const reducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth && !reducedMotion ? 'smooth' : 'auto',
    });
    isNearBottomRef.current = true;
    setShowJumpToLatest(false);
  }

  function handleScroll() {
    const el = scrollContainerRef.current;
    if (!el) {
      return;
    }
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom <= 72;
    isNearBottomRef.current = nearBottom;
    setShowJumpToLatest(!nearBottom && messages.length > 0);
  }

  useEffect(() => {
    if (scrollTrigger > 0) {
      scrollToBottom(true);
    }
  }, [scrollTrigger]);

  useEffect(() => {
    if (isNearBottomRef.current) {
      const el = scrollContainerRef.current;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
      setShowJumpToLatest(false);
    }
  }, [messages, sending]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        className="cinebot-scrollbar flex-1 space-y-4 overflow-y-auto px-3.5 py-4"
      >
        {loadingMessages && messages.length === 0 ? (
          <div className="space-y-3 py-4" aria-label={t('cinebot.loadingMessages')}>
            <div className="ml-auto h-9 w-2/3 animate-pulse rounded-2xl bg-surface-container-high motion-reduce:animate-none" />
            <div className="h-16 w-4/5 animate-pulse rounded-2xl bg-surface-container motion-reduce:animate-none" />
            <div className="h-12 w-3/5 animate-pulse rounded-2xl bg-surface-container motion-reduce:animate-none" />
          </div>
        ) : messages.length === 0 ? (
          <SuggestionChips
            isAuthenticated={isAuthenticated}
            disabled={sending}
            onSelectPrompt={onSelectPrompt}
          />
        ) : (
          messages.map((message, idx) => {
            const isLastMsg = idx === messages.length - 1;
            const isStreamingMsg = sending && isLastMsg && message.role === 'assistant';
            const isLastAssistantMsg = idx === lastAssistantIndex;
            return (
              <MessageBubble
                key={message.id}
                message={message}
                lang={lang}
                isStreaming={isStreamingMsg}
                isLastAssistant={isLastAssistantMsg}
                isSending={sending}
                feedback={feedbackByMessage[String(message.id)]}
                onRegenerate={onRegenerate}
                onFeedback={onFeedback}
                onSelectFollowUp={onSelectPrompt}
              />
            );
          })
        )}

        {error && (
          <div
            role="alert"
            className="flex items-center justify-between gap-2 rounded-xl border border-error/30 bg-error-container/60 px-3 py-2 text-xs text-on-error-container"
          >
            <div className="flex min-w-0 items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-error" aria-hidden="true" />
              <span className="leading-snug">{error}</span>
            </div>
            {canRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-error/30 bg-surface-container-lowest px-2.5 py-1 text-[11px] font-semibold text-error transition-colors hover:bg-error hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
                {t('cinebot.retry')}
              </button>
            )}
          </div>
        )}
      </div>

      {showJumpToLatest && (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-3 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-lowest/95 px-3 py-1.5 text-xs font-medium text-on-surface shadow-lg backdrop-blur-md transition-colors hover:bg-surface-container dark:bg-surface-container-high/95 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowDown className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          <span>{t('cinebot.jumpToLatest')}</span>
        </button>
      )}
    </div>
  );
}
