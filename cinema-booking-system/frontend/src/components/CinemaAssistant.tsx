import { FormEvent, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Check, MessageSquare, Pencil, Plus, Send, Trash2, X } from 'lucide-react';
import {
  ChatMessage,
  ChatSessionSummary,
  createSession,
  deleteSession,
  getSessionDetail,
  listSessions,
  renameSession,
  streamChatMessage,
} from '../services/chatbotApi';

const MAX_MESSAGE_LENGTH = 500;

export function CinemaAssistant() {
  const location = useLocation();
  const hidden =
    location.pathname.startsWith('/admin') || location.pathname.startsWith('/staff');

  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const skipNextFetchRef = useRef(false);

  useEffect(() => {
    if (!open || hidden) {
      return;
    }
    let cancelled = false;
    setError('');
    listSessions()
      .then(async (found) => {
        if (cancelled) {
          return;
        }
        const next = found.length > 0 ? found : [await createSession()];
        if (cancelled) {
          return;
        }
        setSessions(next);
        setActiveId((current) => current ?? next[0]?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setError('Unable to connect to CineBot assistant.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, hidden]);

  useEffect(() => {
    if (!open || !activeId) {
      return;
    }
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }
    let cancelled = false;
    getSessionDetail(activeId)
      .then((detail) => {
        if (!cancelled) {
          setMessages(detail.messages ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Unable to load conversation messages.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, activeId]);

  if (hidden) {
    return null;
  }

  async function handleCreateSession() {
    setError('');
    try {
      const created = await createSession();
      skipNextFetchRef.current = true;
      setSessions((current) => [created, ...current]);
      setActiveId(created.id);
      setMessages([]);
      setEditingId(null);
    } catch {
      setError('Unable to create conversation.');
    }
  }

  function startEditing(session: ChatSessionSummary) {
    setEditingId(session.id);
    setEditingTitle(session.title || '');
    setError('');
  }

  async function submitRename(sessionId: string) {
    const trimmed = editingTitle.trim();
    if (!trimmed) {
      setError('Conversation title cannot be blank.');
      return;
    }
    setError('');
    try {
      const updated = await renameSession(sessionId, trimmed);
      setSessions((current) =>
        current.map((item) => (item.id === sessionId ? { ...item, title: updated.title } : item)),
      );
      setEditingId(null);
      setEditingTitle('');
    } catch {
      setError('Unable to rename conversation.');
    }
  }

  async function handleDeleteSession(id: string) {
    setError('');
    try {
      await deleteSession(id);
      const remaining = sessions.filter((item) => item.id !== id);
      setSessions(remaining);
      if (editingId === id) {
        setEditingId(null);
      }
      if (activeId === id) {
        setActiveId(remaining[0]?.id ?? null);
        setMessages([]);
      }
    } catch {
      setError('Unable to delete conversation.');
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || text.length > MAX_MESSAGE_LENGTH || sending) {
      return;
    }

    setSending(true);
    setError('');
    setDraft('');

    const userMsg: ChatMessage = {
      id: `local-user-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    const assistantId = `local-assistant-${Date.now()}`;
    const placeholderMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      sources: [],
      createdAt: new Date().toISOString(),
    };

    setMessages((current) => [...current, userMsg, placeholderMsg]);

    try {
      await streamChatMessage(activeId, text, (payload) => {
        if (!payload.done && payload.chunk) {
          setMessages((current) =>
            current.map((item) =>
              item.id === assistantId
                ? { ...item, content: item.content + payload.chunk }
                : item,
            ),
          );
          return;
        }

        if (payload.done) {
          if (payload.sessionId && payload.sessionId !== activeId) {
            skipNextFetchRef.current = true;
            setActiveId(payload.sessionId);
          }

          setMessages((current) =>
            current.map((item) => {
              if (item.id !== assistantId) {
                return item;
              }
              if (payload.replacement) {
                return {
                  ...item,
                  content: payload.replacement,
                  sources: [],
                  cached: false,
                };
              }
              return {
                ...item,
                sources: payload.sources ?? [],
                cached: Boolean(payload.cached),
              };
            }),
          );
        }
      });
    } catch {
      setError('Unable to reach CineBot right now.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open && (
        <div className="mb-3 flex h-[30rem] w-[26rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border border-outline bg-surface text-on-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-outline px-3 py-2 bg-surface-container-low">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">CineBot Assistant</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary hover:bg-surface-container"
                onClick={() => handleCreateSession()}
              >
                <Plus className="h-3.5 w-3.5" />
                New chat
              </button>
              <button
                type="button"
                aria-label="Close assistant"
                className="rounded p-1 text-on-surface-variant hover:bg-surface-container"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1">
            <aside className="w-36 shrink-0 overflow-y-auto border-r border-outline bg-surface-container-lowest">
              {sessions.map((session) => {
                const isActive = session.id === activeId;
                const isEditing = editingId === session.id;
                return (
                  <div
                    key={session.id}
                    className={`border-b border-outline/40 p-2 ${isActive ? 'bg-surface-container' : ''}`}
                  >
                    {isEditing ? (
                      <div className="space-y-1">
                        <input
                          value={editingTitle}
                          maxLength={255}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              submitRename(session.id);
                            } else if (e.key === 'Escape') {
                              setEditingId(null);
                            }
                          }}
                          className="w-full rounded border border-outline bg-surface px-1.5 py-0.5 text-xs"
                          aria-label="Edit conversation title"
                        />
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            aria-label="Save title"
                            className="rounded p-0.5 text-success hover:bg-surface-container-high"
                            onClick={() => submitRename(session.id)}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Cancel rename"
                            className="rounded p-0.5 text-on-surface-variant hover:bg-surface-container-high"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="block w-full truncate text-left text-xs font-medium"
                          title={session.title || 'New Conversation'}
                          onClick={() => setActiveId(session.id)}
                        >
                          {session.title || 'New Conversation'}
                        </button>
                        <div className="mt-1 flex items-center gap-2 text-on-surface-variant">
                          <button
                            type="button"
                            aria-label="Rename conversation"
                            className="hover:text-on-surface"
                            onClick={() => startEditing(session)}
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            aria-label="Delete conversation"
                            className="hover:text-error"
                            onClick={() => handleDeleteSession(session.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </aside>

            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex-1 space-y-2.5 overflow-y-auto p-3 text-sm">
                {messages.length === 0 && (
                  <p className="text-xs text-on-surface-variant">
                    Ask about movies, showtimes, cinema policies, or your ticket orders.
                  </p>
                )}
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={message.role === 'user' ? 'flex justify-end' : 'flex flex-col items-start'}
                  >
                    <div
                      className={`max-w-[90%] whitespace-pre-wrap rounded-lg px-2.5 py-1.5 text-xs leading-relaxed ${
                        message.role === 'user'
                          ? 'bg-primary-container text-on-primary-container'
                          : 'bg-surface-container text-on-surface'
                      }`}
                    >
                      {message.content || (sending ? '...' : '')}
                    </div>
                    {message.sources && message.sources.length > 0 && (
                      <details className="mt-1 max-w-[90%] text-[11px] text-on-surface-variant">
                        <summary className="cursor-pointer font-medium">
                          Sources ({message.sources.length})
                        </summary>
                        <div className="mt-1 space-y-1 border-l-2 border-outline/60 pl-2">
                          {message.sources.map((src, idx) => (
                            <p key={`${src.type}-${src.id ?? idx}`}>
                              <span className="font-semibold">{src.title}</span>
                              {src.snippet ? `: ${src.snippet}` : ''}
                            </p>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                ))}
                {error && <p className="text-xs text-error">{error}</p>}
              </div>

              <form onSubmit={handleSubmit} className="flex gap-2 border-t border-outline p-2">
                <input
                  value={draft}
                  maxLength={MAX_MESSAGE_LENGTH}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Ask about movies, showtimes, or orders..."
                  className="min-w-0 flex-1 rounded border border-outline bg-surface px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  type="submit"
                  aria-label="Send message"
                  disabled={sending || draft.trim().length === 0}
                  className="inline-flex items-center justify-center rounded bg-primary-container px-2.5 py-1 text-xs text-on-primary-container disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-full bg-primary-container px-4 py-2.5 text-sm font-medium text-on-primary-container shadow-lg hover:opacity-95"
        onClick={() => setOpen((current) => !current)}
      >
        <MessageSquare className="h-4 w-4" />
        {open ? 'Close CineBot' : 'CineBot'}
      </button>
    </div>
  );
}
