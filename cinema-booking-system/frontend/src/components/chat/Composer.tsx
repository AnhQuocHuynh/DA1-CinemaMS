import { KeyboardEvent, RefObject, useEffect, useState } from 'react';
import { ArrowUp, Square } from 'lucide-react';
import { useCinebotTranslation } from './useCinebotTranslation';

interface ComposerProps {
  draft: string;
  maxLength: number;
  sending: boolean;
  isAuthenticated: boolean;
  textareaRef: RefObject<HTMLTextAreaElement>;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
}

export function Composer({
  draft,
  maxLength,
  sending,
  isAuthenticated,
  textareaRef,
  onChange,
  onSend,
  onStop,
}: ComposerProps) {
  const { t } = useCinebotTranslation();
  const [isNarrowScreen, setIsNarrowScreen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const query = window.matchMedia('(max-width: 379px)');
    const update = () => setIsNarrowScreen(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) {
      return;
    }
    el.style.height = 'auto';
    const nextHeight = Math.min(el.scrollHeight, 120);
    el.style.height = `${Math.max(nextHeight, 24)}px`;
  }, [draft, textareaRef]);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (!sending && draft.trim().length > 0) {
        onSend();
      }
    }
  }

  const placeholder = isNarrowScreen
    ? t('cinebot.placeholderShort')
    : isAuthenticated
      ? t('cinebot.placeholder')
      : t('cinebot.guestPlaceholder');

  const canSend = draft.trim().length > 0;

  return (
    <div className="shrink-0 border-t border-outline-variant/70 bg-surface-container-low/75 px-3 pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-md dark:bg-surface-container-low/90">
      <div className="flex items-end gap-2 rounded-2xl border border-outline-variant bg-surface-container-lowest px-3 py-2 shadow-sm transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/20 dark:bg-surface-container-low">
        <textarea
          ref={textareaRef}
          rows={1}
          value={draft}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label={t('cinebot.messageInputLabel')}
          className="cinebot-scrollbar max-h-[120px] min-h-[24px] flex-1 resize-none bg-transparent py-1 text-base sm:text-[13.5px] leading-relaxed text-on-surface placeholder:text-on-surface-variant/75 focus:outline-none"
        />

        {sending ? (
          <button
            type="button"
            onClick={onStop}
            aria-label={t('cinebot.stop')}
            title={t('cinebot.stop')}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-on-surface text-surface transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            disabled={!canSend}
            onClick={onSend}
            aria-label={t('cinebot.send')}
            title={t('cinebot.send')}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-all hover:bg-accent disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowUp className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2 px-1">
        <p className="text-[10.5px] text-on-surface-variant/80">
          {t('cinebot.disclaimer')}
        </p>
        {draft.length >= 400 && (
          <span className="shrink-0 text-[10px] font-medium text-on-surface-variant">
            {draft.length}/{maxLength}
          </span>
        )}
      </div>
    </div>
  );
}
