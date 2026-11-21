import {
  Armchair,
  Building2,
  CreditCard,
  Film,
  Info,
  ShieldCheck,
  Sparkles,
  Ticket,
} from 'lucide-react';
import { useCinebotTranslation } from './useCinebotTranslation';
import type { SuggestionChipItem } from './types';

interface SuggestionChipsProps {
  isAuthenticated: boolean;
  disabled: boolean;
  onSelectPrompt: (prompt: string) => void;
}

export function SuggestionChips({
  isAuthenticated,
  disabled,
  onSelectPrompt,
}: SuggestionChipsProps) {
  const { t } = useCinebotTranslation();

  const items: Array<SuggestionChipItem & { icon: JSX.Element }> = isAuthenticated
    ? [
        {
          id: 'showtimes',
          label: t('cinebot.suggestions.showtimes.label'),
          prompt: t('cinebot.suggestions.showtimes.prompt'),
          icon: <Film className="h-4 w-4 text-primary" aria-hidden="true" />,
        },
        {
          id: 'tickets',
          label: t('cinebot.suggestions.tickets.label'),
          prompt: t('cinebot.suggestions.tickets.prompt'),
          icon: <Ticket className="h-4 w-4 text-primary" aria-hidden="true" />,
        },
        {
          id: 'refund',
          label: t('cinebot.suggestions.refund.label'),
          prompt: t('cinebot.suggestions.refund.prompt'),
          icon: <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />,
        },
        {
          id: 'rental',
          label: t('cinebot.suggestions.rental.label'),
          prompt: t('cinebot.suggestions.rental.prompt'),
          icon: <Building2 className="h-4 w-4 text-primary" aria-hidden="true" />,
        },
      ]
    : [
        {
          id: 'refund',
          label: t('cinebot.guestSuggestions.refund.label'),
          prompt: t('cinebot.guestSuggestions.refund.prompt'),
          icon: <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />,
        },
        {
          id: 'seats',
          label: t('cinebot.guestSuggestions.seats.label'),
          prompt: t('cinebot.guestSuggestions.seats.prompt'),
          icon: <Armchair className="h-4 w-4 text-primary" aria-hidden="true" />,
        },
        {
          id: 'payment',
          label: t('cinebot.guestSuggestions.payment.label'),
          prompt: t('cinebot.guestSuggestions.payment.prompt'),
          icon: <CreditCard className="h-4 w-4 text-primary" aria-hidden="true" />,
        },
        {
          id: 'ratings',
          label: t('cinebot.guestSuggestions.ratings.label'),
          prompt: t('cinebot.guestSuggestions.ratings.prompt'),
          icon: <Info className="h-4 w-4 text-primary" aria-hidden="true" />,
        },
      ];

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-2 py-6 text-center">
      <div
        className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-md shadow-primary/20"
        aria-hidden="true"
      >
        <Sparkles className="h-6 w-6" />
      </div>

      <h3 className="text-base font-semibold tracking-tight text-on-surface">
        {t('cinebot.greetingTitle')}
      </h3>
      <p className="mt-1 max-w-[300px] text-xs leading-relaxed text-on-surface-variant">
        {isAuthenticated ? t('cinebot.greetingSubtitle') : t('cinebot.guestSubtitle')}
      </p>

      <div className="mt-5 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelectPrompt(item.prompt)}
            className="flex items-center gap-2.5 rounded-xl border border-outline-variant/80 bg-surface-container-lowest/90 px-3 py-2.5 text-left text-xs font-medium text-on-surface shadow-sm transition-all hover:border-primary/50 hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50 dark:bg-surface-container-low/90 dark:hover:bg-surface-container focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              {item.icon}
            </span>
            <span className="line-clamp-2 leading-snug">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
