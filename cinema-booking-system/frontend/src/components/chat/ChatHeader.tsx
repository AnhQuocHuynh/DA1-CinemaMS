import type { RefObject } from 'react';
import {
  ChevronDown,
  History,
  LogIn,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sparkles,
  SquarePen,
  X,
} from 'lucide-react';
import { useCinebotTranslation } from './useCinebotTranslation';

interface ChatHeaderProps {
  isAuthenticated: boolean;
  isExpanded: boolean;
  historyOpen: boolean;
  activeTitle: string | null;
  hasMessages: boolean;
  onNewChat: () => void;
  onToggleHistory: () => void;
  onToggleExpand: () => void;
  onClearGuest: () => void;
  onSignIn: () => void;
  onClose: () => void;
  historyButtonRef: RefObject<HTMLButtonElement>;
  titleButtonRef: RefObject<HTMLButtonElement>;
}

export function ChatHeader({
  isAuthenticated,
  isExpanded,
  historyOpen,
  activeTitle,
  hasMessages,
  onNewChat,
  onToggleHistory,
  onToggleExpand,
  onClearGuest,
  onSignIn,
  onClose,
  historyButtonRef,
  titleButtonRef,
}: ChatHeaderProps) {
  const { t } = useCinebotTranslation();

  const iconBtnClass =
    'inline-flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <header className="relative z-20 flex shrink-0 items-center justify-between gap-2 border-b border-outline-variant/70 bg-surface-container-low/90 px-3.5 py-2.5 backdrop-blur-md dark:bg-surface-container-low/95">
      <div className="flex min-w-0 items-center gap-2.5">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-white shadow-sm"
          aria-hidden="true"
        >
          <Sparkles className="h-4 w-4" />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-semibold tracking-tight text-on-surface">
              {t('cinebot.name')}
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              {t('cinebot.online')}
            </span>
            {!isAuthenticated && (
              <span className="rounded-full bg-surface-container-high px-1.5 py-0.5 text-[10px] font-medium text-on-surface-variant">
                {t('cinebot.guestBadge')}
              </span>
            )}
          </div>

          {isAuthenticated && !isExpanded && (
            <button
              ref={titleButtonRef}
              type="button"
              onClick={onToggleHistory}
              aria-haspopup="listbox"
              aria-expanded={historyOpen}
              title={activeTitle || t('cinebot.untitledChat')}
              className="mt-0.5 flex max-w-[180px] items-center gap-1 rounded px-0.5 text-[11px] font-medium text-on-surface-variant transition-colors hover:text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="truncate">{activeTitle || t('cinebot.untitledChat')}</span>
              <ChevronDown
                className={`h-3 w-3 shrink-0 transition-transform duration-150 motion-reduce:transition-none ${
                  historyOpen ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </button>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {isAuthenticated ? (
          <>
            <button
              type="button"
              onClick={onNewChat}
              aria-label={t('cinebot.newChat')}
              title={t('cinebot.newChat')}
              className={iconBtnClass}
            >
              <SquarePen className="h-4 w-4" aria-hidden="true" />
            </button>

            <button
              ref={historyButtonRef}
              type="button"
              onClick={onToggleHistory}
              aria-haspopup="listbox"
              aria-expanded={historyOpen}
              aria-label={t('cinebot.history')}
              title={t('cinebot.history')}
              className={`${iconBtnClass} ${
                isExpanded ? 'sm:hidden' : ''
              } ${historyOpen ? 'bg-surface-container-high text-on-surface' : ''}`}
            >
              <History className="h-4 w-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={onToggleExpand}
              aria-label={isExpanded ? t('cinebot.collapse') : t('cinebot.expand')}
              title={isExpanded ? t('cinebot.collapse') : t('cinebot.expand')}
              className={`hidden sm:inline-flex ${iconBtnClass}`}
            >
              {isExpanded ? (
                <Minimize2 className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Maximize2 className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </>
        ) : (
          <>
            {hasMessages && (
              <button
                type="button"
                onClick={onClearGuest}
                aria-label={t('cinebot.clearChat')}
                title={t('cinebot.clearChat')}
                className={iconBtnClass}
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={onSignIn}
              className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t('cinebot.signIn')}</span>
            </button>
          </>
        )}

        <button
          type="button"
          onClick={onClose}
          aria-label={t('cinebot.closeAssistant')}
          title={t('cinebot.minimizeAssistant')}
          className={iconBtnClass}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
