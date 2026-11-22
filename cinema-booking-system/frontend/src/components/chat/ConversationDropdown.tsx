import {
  KeyboardEvent,
  RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Check, MessageSquare, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import type { ChatSessionSummary } from '../../services/chatbotApi';
import { groupSessionsByDate } from '../../utils/chatTicketParser';
import { useCinebotTranslation } from './useCinebotTranslation';

interface ConversationDropdownProps {
  variant: 'dropdown' | 'sidebar';
  sessions: ChatSessionSummary[];
  activeId: string | null;
  onSelect: (sessionId: string) => void;
  onCreate: () => void;
  onRename: (sessionId: string, title: string) => Promise<boolean>;
  onDelete: (sessionId: string) => Promise<boolean>;
  onClose?: () => void;
  ignoreOutsideRefs?: Array<RefObject<HTMLElement>>;
}

export function ConversationDropdown({
  variant,
  sessions,
  activeId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onClose,
  ignoreOutsideRefs = [],
}: ConversationDropdownProps) {
  const { t } = useCinebotTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return sessions;
    }
    return sessions.filter((session) => {
      const label = (session.title || t('cinebot.untitledChat')).toLowerCase();
      return label.includes(q);
    });
  }, [sessions, searchQuery, t]);

  const groups = useMemo(() => groupSessionsByDate(filteredSessions), [filteredSessions]);

  const flatIds = useMemo(
    () => groups.flatMap((group) => group.sessions.map((session) => session.id)),
    [groups],
  );

  useEffect(() => {
    if (variant === 'dropdown') {
      searchInputRef.current?.focus();
    }
  }, [variant]);

  useEffect(() => {
    if (editingId) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [editingId]);

  useEffect(() => {
    if (variant !== 'dropdown' || !onClose) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) {
        return;
      }
      for (const ref of ignoreOutsideRefs) {
        if (ref.current?.contains(target)) {
          return;
        }
      }
      onClose();
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [variant, onClose, ignoreOutsideRefs]);

  async function handleSubmitRename(sessionId: string) {
    const trimmed = editingTitle.trim();
    if (!trimmed || busyId) {
      return;
    }
    setBusyId(sessionId);
    const ok = await onRename(sessionId, trimmed);
    setBusyId(null);
    if (ok) {
      setEditingId(null);
      setEditingTitle('');
    }
  }

  async function handleConfirmDelete(sessionId: string) {
    if (busyId) {
      return;
    }
    setBusyId(sessionId);
    const ok = await onDelete(sessionId);
    setBusyId(null);
    if (ok) {
      setConfirmDeleteId(null);
    }
  }

  function handleListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (editingId || confirmDeleteId) {
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      return;
    }
    if (flatIds.length === 0) {
      return;
    }
    event.preventDefault();
    const options = Array.from(
      containerRef.current?.querySelectorAll<HTMLButtonElement>('[data-session-option="true"]') ?? [],
    );
    if (options.length === 0) {
      return;
    }
    const currentIdx = options.findIndex((el) => el === document.activeElement);
    const nextIdx =
      event.key === 'ArrowDown'
        ? currentIdx < options.length - 1
          ? currentIdx + 1
          : 0
        : currentIdx > 0
          ? currentIdx - 1
          : options.length - 1;
    options[nextIdx]?.focus();
  }

  const wrapperClass =
    variant === 'dropdown'
      ? 'absolute left-2.5 right-2.5 top-[calc(100%+6px)] z-30 flex max-h-[390px] flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest/95 shadow-2xl backdrop-blur-xl dark:bg-surface-container-low/95'
      : 'hidden sm:flex w-60 shrink-0 flex-col border-r border-outline-variant/70 bg-surface-container-lowest/70 dark:bg-surface-container-low/70';

  return (
    <div
      ref={containerRef}
      className={wrapperClass}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          if (editingId) {
            e.stopPropagation();
            setEditingId(null);
            return;
          }
          if (confirmDeleteId) {
            e.stopPropagation();
            setConfirmDeleteId(null);
            return;
          }
          if (searchQuery) {
            e.stopPropagation();
            setSearchQuery('');
            return;
          }
          if (variant === 'dropdown' && onClose) {
            e.stopPropagation();
            onClose();
          }
        }
      }}
    >
      <div className="flex items-center gap-1.5 border-b border-outline-variant/60 p-2.5">
        <div className="relative flex flex-1 items-center">
          <Search
            className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-on-surface-variant"
            aria-hidden="true"
          />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('cinebot.searchPlaceholder')}
            aria-label={t('cinebot.searchPlaceholder')}
            className="w-full rounded-lg border border-outline-variant/80 bg-surface-container-low py-1.5 pl-8 pr-7 text-xs text-on-surface placeholder:text-on-surface-variant/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/25"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label={t('cinebot.clearSearch')}
              className="absolute right-1.5 rounded p-0.5 text-on-surface-variant hover:bg-surface-container hover:text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {variant === 'sidebar' && (
          <button
            type="button"
            onClick={onCreate}
            aria-label={t('cinebot.newChat')}
            title={t('cinebot.newChat')}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-outline-variant/80 bg-surface-container-low text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <div
        role="listbox"
        aria-label={t('cinebot.history')}
        onKeyDown={handleListKeyDown}
        className="cinebot-scrollbar flex-1 space-y-3 overflow-y-auto p-2"
      >
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 px-3 py-8 text-center text-xs text-on-surface-variant">
            <MessageSquare className="h-5 w-5 opacity-40" aria-hidden="true" />
            <span>
              {sessions.length === 0
                ? t('cinebot.noConversations')
                : t('cinebot.noSearchResults')}
            </span>
          </div>
        ) : (
          groups.map((group) => (
            <div
              key={group.key}
              role="group"
              aria-labelledby={`cinebot-group-${group.key}`}
              className="space-y-0.5"
            >
              <div
                id={`cinebot-group-${group.key}`}
                className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/80"
              >
                {t(`cinebot.groups.${group.key}`)}
              </div>
              {group.sessions.map((session) => {
                const isActive = session.id === activeId;
                const isEditing = editingId === session.id;
                const isConfirmingDelete = confirmDeleteId === session.id;
                const displayTitle = session.title || t('cinebot.untitledChat');

                if (isEditing) {
                  return (
                    <div
                      key={session.id}
                      className="flex items-center gap-1 rounded-lg bg-surface-container px-2 py-1.5"
                    >
                      <input
                        ref={renameInputRef}
                        type="text"
                        value={editingTitle}
                        maxLength={255}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void handleSubmitRename(session.id);
                          } else if (e.key === 'Escape') {
                            e.stopPropagation();
                            setEditingId(null);
                          }
                        }}
                        aria-label={t('cinebot.renameInputLabel')}
                        className="min-w-0 flex-1 rounded border border-outline-variant bg-surface px-2 py-1 text-xs text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/25"
                      />
                      <button
                        type="button"
                        disabled={busyId === session.id || !editingTitle.trim()}
                        onClick={() => void handleSubmitRename(session.id)}
                        aria-label={t('cinebot.save')}
                        className="rounded p-1 text-emerald-600 hover:bg-surface-container-high disabled:opacity-40 dark:text-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        aria-label={t('cinebot.cancel')}
                        className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                }

                return (
                  <div
                    key={session.id}
                    className={`group relative flex items-center gap-1 rounded-lg px-2 py-1.5 transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-on-surface'
                        : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                    }`}
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      data-session-option="true"
                      onClick={() => {
                        onSelect(session.id);
                        if (variant === 'dropdown') {
                          onClose?.();
                        }
                      }}
                      title={displayTitle}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded text-left text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          isActive ? 'bg-primary' : 'bg-transparent'
                        }`}
                        aria-hidden="true"
                      />
                      <span className="truncate">{displayTitle}</span>
                    </button>

                    {isConfirmingDelete ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <span className="text-[11px] font-medium text-error">
                          {t('cinebot.deleteConfirmPrompt')}
                        </span>
                        <button
                          type="button"
                          disabled={busyId === session.id}
                          onClick={() => void handleConfirmDelete(session.id)}
                          aria-label={t('cinebot.confirmDelete')}
                          className="rounded bg-error px-1.5 py-0.5 text-[10px] font-semibold text-white hover:opacity-90 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          aria-label={t('cinebot.cancel')}
                          className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                        <button
                          type="button"
                          aria-label={t('cinebot.rename')}
                          title={t('cinebot.rename')}
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(null);
                            setEditingId(session.id);
                            setEditingTitle(session.title || '');
                          }}
                          className="rounded p-1 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          aria-label={t('cinebot.delete')}
                          title={t('cinebot.delete')}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(null);
                            setConfirmDeleteId(session.id);
                          }}
                          className="rounded p-1 text-on-surface-variant transition-colors hover:bg-error/10 hover:text-error focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
