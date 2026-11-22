import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Check,
  ChevronRight,
  Copy,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import type { ChatMessage } from '../../services/chatbotApi';
import {
  formatExactTime,
  formatRelativeTime,
  parseMessageTicketSegments,
} from '../../utils/chatTicketParser';
import { TicketCard } from './TicketCard';
import { useCinebotTranslation } from './useCinebotTranslation';
import type { MessageFeedback } from './types';

interface MessageBubbleProps {
  message: ChatMessage;
  lang: 'en' | 'vi';
  isStreaming: boolean;
  isLastAssistant: boolean;
  isSending: boolean;
  feedback?: MessageFeedback;
  onRegenerate: () => void;
  onFeedback: (messageId: string | number, value: MessageFeedback) => void;
  onSelectFollowUp: (prompt: string) => void;
}

function safeUrlTransform(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    return '';
  }
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }
  if (trimmed.startsWith('#')) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed, 'https://cinema.local');
    if (
      parsed.protocol === 'http:' ||
      parsed.protocol === 'https:' ||
      parsed.protocol === 'mailto:'
    ) {
      return trimmed;
    }
  } catch {
    return '';
  }
  return '';
}

const markdownComponents: Components = {
  a: ({ href, children }) => {
    const safeHref = href ? safeUrlTransform(href) : '';
    if (!safeHref) {
      return <span>{children}</span>;
    }
    if (safeHref.startsWith('/')) {
      return (
        <Link
          to={safeHref}
          className="font-medium text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:text-accent hover:decoration-accent"
        >
          {children}
        </Link>
      );
    }
    return (
      <a
        href={safeHref}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:text-accent hover:decoration-accent"
      >
        {children}
      </a>
    );
  },
  p: ({ children }) => <p className="mb-2 leading-relaxed last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-4 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-4 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  h1: ({ children }) => (
    <h3 className="mb-1.5 mt-2.5 text-sm font-semibold text-on-surface first:mt-0">{children}</h3>
  ),
  h2: ({ children }) => (
    <h4 className="mb-1.5 mt-2.5 text-sm font-semibold text-on-surface first:mt-0">{children}</h4>
  ),
  h3: ({ children }) => (
    <h5 className="mb-1 mt-2 text-[13px] font-semibold text-on-surface first:mt-0">{children}</h5>
  ),
  h4: ({ children }) => (
    <h6 className="mb-1 mt-2 text-[13px] font-semibold text-on-surface first:mt-0">{children}</h6>
  ),
  strong: ({ children }) => <strong className="font-semibold text-on-surface">{children}</strong>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-primary/50 pl-3 italic text-on-surface-variant">
      {children}
    </blockquote>
  ),
  pre: ({ children }) => (
    <pre className="cinebot-scrollbar my-2 overflow-x-auto rounded-lg border border-outline-variant/70 bg-surface-container p-2.5 text-xs text-on-surface [&_code]:bg-transparent [&_code]:p-0">
      {children}
    </pre>
  ),
  code: ({ children }) => (
    <code className="rounded bg-surface-container-high px-1 py-0.5 font-mono text-[12px] text-on-surface">
      {children}
    </code>
  ),
  table: ({ children }) => (
    <div className="cinebot-scrollbar my-2 overflow-x-auto rounded-lg border border-outline-variant/80">
      <table className="w-full border-collapse text-left text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-surface-container text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
      {children}
    </thead>
  ),
  th: ({ children }) => (
    <th className="border-b border-outline-variant/70 px-2.5 py-1.5">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-b border-outline-variant/50 px-2.5 py-1.5">{children}</td>
  ),
  hr: () => <hr className="my-2.5 border-outline-variant/60" />,
};

export function MessageBubble({
  message,
  lang,
  isStreaming,
  isLastAssistant,
  isSending,
  feedback,
  onRegenerate,
  onFeedback,
  onSelectFollowUp,
}: MessageBubbleProps) {
  const { t } = useCinebotTranslation();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const segments = useMemo(() => {
    if (message.role !== 'assistant' || isStreaming || !message.content) {
      return [];
    }
    return parseMessageTicketSegments(message.content);
  }, [message.role, message.content, isStreaming]);

  const relativeTime = formatRelativeTime(message.createdAt, lang, t);
  const exactTime = formatExactTime(message.createdAt, lang);

  async function handleCopy() {
    if (!message.content) {
      return;
    }
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
    } catch {
      // Clipboard API may be unavailable in restricted contexts.
    }
  }

  if (message.role === 'user') {
    return (
      <div className="group flex flex-col items-end">
        <div className="max-w-[82%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-gradient-to-br from-primary to-primary-container px-3.5 py-2.5 text-[13.5px] leading-relaxed text-white shadow-sm">
          {message.content}
        </div>
        <div className="mt-1 flex items-center gap-2 pr-1 text-[10.5px] text-on-surface-variant opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          {relativeTime && <span title={exactTime}>{relativeTime}</span>}
          <button
            type="button"
            onClick={() => void handleCopy()}
            aria-label={copied ? t('cinebot.copied') : t('cinebot.copy')}
            title={copied ? t('cinebot.copied') : t('cinebot.copy')}
            className="inline-flex items-center gap-1 rounded p-0.5 transition-colors hover:text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          </button>
        </div>
      </div>
    );
  }

  const showThinking = isStreaming && !message.content;
  const followUps = isLastAssistant && !isSending ? (message.suggestedFollowUps ?? []).slice(0, 3) : [];
  const hasActionHighlights = copied || Boolean(feedback);

  return (
    <div className="group flex items-start gap-2.5">
      <div
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-white shadow-sm"
        aria-hidden="true"
      >
        <Sparkles className="h-3.5 w-3.5" />
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        {showThinking ? (
          <div
            className="inline-flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-outline-variant/60 bg-surface-container-low/80 px-3.5 py-2.5 dark:bg-surface-container/60"
            aria-label={t('cinebot.thinking')}
          >
            <span className="cinebot-typing-dot h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="cinebot-typing-dot h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="cinebot-typing-dot h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="sr-only">{t('cinebot.thinking')}</span>
          </div>
        ) : (
          <div className="space-y-2 text-[13.5px] leading-relaxed text-on-surface">
            {isStreaming ? (
              <div className="rounded-2xl rounded-tl-sm bg-surface-container-low/65 px-3 py-2 dark:bg-surface-container/45">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  urlTransform={safeUrlTransform}
                  components={markdownComponents}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            ) : !message.content ? (
              <p className="rounded-2xl rounded-tl-sm bg-surface-container-low/65 px-3 py-2 text-xs italic text-on-surface-variant dark:bg-surface-container/45">
                {t('cinebot.stopped')}
              </p>
            ) : (
              segments.map((segment, index) => {
                if (segment.type === 'tickets') {
                  return (
                    <div key={`tickets-${index}`} className="space-y-2">
                      {segment.tickets.map((ticket) => (
                        <TicketCard key={`${ticket.orderId}-${ticket.movieTitle}`} ticket={ticket} />
                      ))}
                    </div>
                  );
                }
                return (
                  <div
                    key={`md-${index}`}
                    className="rounded-2xl rounded-tl-sm bg-surface-container-low/65 px-3 py-2 dark:bg-surface-container/45"
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      urlTransform={safeUrlTransform}
                      components={markdownComponents}
                    >
                      {segment.content}
                    </ReactMarkdown>
                  </div>
                );
              })
            )}
          </div>
        )}

        {message.sources && message.sources.length > 0 && !isStreaming && (
          <details className="group/sources rounded-xl border border-outline-variant/60 bg-surface-container-low/60 px-2.5 py-1.5 text-[11px] text-on-surface-variant">
            <summary className="flex cursor-pointer list-none items-center gap-1 font-medium text-on-surface-variant hover:text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <ChevronRight className="h-3 w-3 transition-transform group-open/sources:rotate-90" />
              <span>
                {t('cinebot.sources')} ({message.sources.length})
              </span>
            </summary>
            <div className="mt-1.5 space-y-1 border-l-2 border-primary/30 pl-2.5">
              {message.sources.map((src, idx) => (
                <p key={`${src.type}-${src.id ?? idx}`} className="leading-snug">
                  <span className="font-semibold text-on-surface">{src.title}</span>
                  {src.snippet ? `: ${src.snippet}` : ''}
                </p>
              ))}
            </div>
          </details>
        )}

        {!isStreaming && Boolean(message.content) && (
          <div
            className={`flex items-center justify-between gap-2 pt-0.5 text-[11px] text-on-surface-variant transition-opacity ${
              hasActionHighlights
                ? 'opacity-100'
                : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100'
            }`}
          >
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void handleCopy()}
                aria-label={copied ? t('cinebot.copied') : t('cinebot.copy')}
                title={copied ? t('cinebot.copied') : t('cinebot.copy')}
                className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 transition-colors hover:bg-surface-container hover:text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-emerald-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>

              {isLastAssistant && !isSending && (
                <button
                  type="button"
                  onClick={onRegenerate}
                  aria-label={t('cinebot.regenerate')}
                  title={t('cinebot.regenerate')}
                  className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 transition-colors hover:bg-surface-container hover:text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <RefreshCw className="h-3 w-3" />
                </button>
              )}

              <button
                type="button"
                onClick={() => onFeedback(message.id, 'up')}
                aria-pressed={feedback === 'up'}
                aria-label={t('cinebot.helpful')}
                title={t('cinebot.helpful')}
                className={`inline-flex h-6 items-center rounded-md px-1.5 transition-colors hover:bg-surface-container focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  feedback === 'up' ? 'text-primary' : 'hover:text-on-surface'
                }`}
              >
                <ThumbsUp className="h-3 w-3" />
              </button>

              <button
                type="button"
                onClick={() => onFeedback(message.id, 'down')}
                aria-pressed={feedback === 'down'}
                aria-label={t('cinebot.notHelpful')}
                title={t('cinebot.notHelpful')}
                className={`inline-flex h-6 items-center rounded-md px-1.5 transition-colors hover:bg-surface-container focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  feedback === 'down' ? 'text-error' : 'hover:text-on-surface'
                }`}
              >
                <ThumbsDown className="h-3 w-3" />
              </button>
            </div>

            {relativeTime && (
              <span className="text-[10.5px] text-on-surface-variant/80" title={exactTime}>
                {relativeTime}
              </span>
            )}
          </div>
        )}

        {followUps.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {followUps.map((followUp) => (
              <button
                key={followUp}
                type="button"
                onClick={() => onSelectFollowUp(followUp)}
                className="rounded-full border border-outline-variant/80 bg-surface-container-lowest px-2.5 py-1 text-left text-[11px] font-medium text-on-surface transition-colors hover:border-primary/50 hover:bg-surface-container-low focus:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-surface-container-low"
              >
                {followUp}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
