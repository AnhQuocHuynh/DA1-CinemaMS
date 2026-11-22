import type { RefObject } from 'react';
import { ChevronDown, Sparkles, X } from 'lucide-react';
import { useCinebotTranslation } from './useCinebotTranslation';

interface ChatLauncherProps {
  isOpen: boolean;
  hasVisited: boolean;
  onToggle: () => void;
  onDismissTooltip: () => void;
  buttonRef: RefObject<HTMLButtonElement>;
}

export function ChatLauncher({
  isOpen,
  hasVisited,
  onToggle,
  onDismissTooltip,
  buttonRef,
}: ChatLauncherProps) {
  const { t } = useCinebotTranslation();

  return (
    <div
      className={`fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] right-4 z-[55] flex-col items-end gap-2.5 md:bottom-5 md:right-5 ${
        isOpen ? 'hidden sm:flex' : 'flex'
      }`}
    >
      {!hasVisited && !isOpen && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-full border border-outline-variant/80 bg-surface-container-lowest/95 px-3 py-1.5 text-xs font-medium text-on-surface shadow-lg backdrop-blur-md dark:bg-surface-container-high/95"
        >
          <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
          <span>{t('cinebot.firstVisitTooltip')}</span>
          <button
            type="button"
            onClick={onDismissTooltip}
            aria-label={t('cinebot.dismissTooltip')}
            className="rounded-full p-0.5 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <button
        ref={buttonRef}
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls="cinebot-dialog"
        aria-label={isOpen ? t('cinebot.closeAssistant') : t('cinebot.openAssistant')}
        className={`cinebot-motion-safe group relative inline-flex items-center justify-center rounded-full bg-gradient-to-r from-primary via-primary-container to-accent text-white shadow-lg shadow-primary/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:translate-y-0 ${
          isOpen ? 'h-12 w-12' : 'h-11 gap-2 px-4'
        }`}
      >
        {isOpen ? (
          <ChevronDown className="h-5 w-5 transition-transform duration-200 motion-reduce:transition-none" aria-hidden="true" />
        ) : (
          <>
            <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="text-sm font-semibold tracking-tight">
              {t('cinebot.launcherLabel')}
            </span>
            {!hasVisited && (
              <span className="relative ml-0.5 flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75 motion-reduce:animate-none" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
            )}
          </>
        )}
      </button>
    </div>
  );
}
