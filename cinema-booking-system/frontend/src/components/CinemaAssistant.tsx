import { FormEvent, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  ChatMessage,
  Citation,
  Conversation,
  createConversation,
  deleteConversation,
  listConversations,
  listMessages,
  streamMessage,
} from '../services/chatbotApi';

export function CinemaAssistant() {
  const location = useLocation();
  const hidden = location.pathname.startsWith('/admin') || location.pathname.startsWith('/staff');
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    listConversations()
      .then(async (found) => {
        if (cancelled) {
          return;
        }
        const next = found.length > 0 ? found : [await createConversation()];
        if (cancelled) {
          return;
        }
        setConversations(next);
        setActiveId((current) => current ?? next[0].id);
      })
      .catch(() => {
        if (!cancelled) {
          setError('Không kết nối được trợ lý.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!activeId) {
      return;
    }
    let cancelled = false;
    listMessages(activeId)
      .then((found) => {
        if (!cancelled) {
          setMessages(found);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Không tải được hội thoại.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  if (hidden) {
    return null;
  }

  async function startConversation() {
    setError('');
    try {
      const created = await createConversation();
      setConversations((current) => [created, ...current]);
      setActiveId(created.id);
      setMessages([]);
    } catch {
      setError('Không tạo được hội thoại.');
    }
  }

  async function removeConversation(id: string) {
    try {
      await deleteConversation(id);
      const remaining = conversations.filter((item) => item.id !== id);
      setConversations(remaining);
      if (activeId === id) {
        setActiveId(remaining[0]?.id ?? null);
        setMessages([]);
      }
    } catch {
      setError('Không xóa được hội thoại.');
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!activeId || !text || text.length > 1000 || sending) {
      return;
    }
    setSending(true);
    setError('');
    setDraft('');
    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      sender: 'USER',
      content: text,
      citations: [],
      createdAt: new Date().toISOString(),
    };
    const assistantId = `local-assistant-${Date.now()}`;
    setMessages((current) => [
      ...current,
      optimistic,
      { id: assistantId, sender: 'ASSISTANT', content: '', citations: [], createdAt: new Date().toISOString() },
    ]);
    try {
      await streamMessage(activeId, text, (name, data) => {
        if (name === 'message') {
          setMessages((current) => current.map((item) => (
            item.id === assistantId ? { ...item, content: item.content + data } : item
          )));
        } else if (name === 'citations') {
          try {
            const citations = JSON.parse(data) as Citation[];
            setMessages((current) => current.map((item) => (
              item.id === assistantId ? { ...item, citations } : item
            )));
          } catch {
            setError('Không đọc được nguồn.');
          }
        } else if (name === 'error') {
          setError(data || 'Lỗi kết nối AI');
        }
      });
    } catch {
      setError('Lỗi kết nối AI');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open && (
        <div className="mb-3 flex h-[28rem] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border border-outline bg-surface text-on-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-outline px-3 py-2">
            <p className="font-semibold">Trợ lý rạp</p>
            <button type="button" className="text-sm text-primary-container" onClick={() => startConversation()}>
              Hội thoại mới
            </button>
          </div>
          <div className="flex min-h-0 flex-1">
            <div className="w-28 overflow-y-auto border-r border-outline">
              {conversations.map((conversation) => (
                <div key={conversation.id} className={conversation.id === activeId ? 'bg-surface-container' : ''}>
                  <button
                    type="button"
                    className="block w-full truncate px-2 py-2 text-left text-sm"
                    onClick={() => setActiveId(conversation.id)}
                  >
                    {conversation.title}
                  </button>
                  <button
                    type="button"
                    className="px-2 pb-2 text-xs text-on-surface-variant"
                    onClick={() => removeConversation(conversation.id)}
                  >
                    Xóa
                  </button>
                </div>
              ))}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
                {messages.map((message) => (
                  <div key={message.id}>
                    <p className={message.sender === 'USER' ? 'text-right' : ''}>
                      <span className="inline-block rounded bg-surface-container px-2 py-1">{message.content}</span>
                    </p>
                    {message.citations?.length > 0 && (
                      <details className="mt-1 text-xs text-on-surface-variant">
                        <summary>Nguồn</summary>
                        {message.citations.map((citation) => (
                          <p key={citation.passageId} className="mt-1">
                            {citation.title || citation.locator}: {citation.text}
                          </p>
                        ))}
                      </details>
                    )}
                  </div>
                ))}
                {error && <p className="text-error">{error}</p>}
              </div>
              <form onSubmit={onSubmit} className="flex gap-2 border-t border-outline p-2">
                <input
                  value={draft}
                  maxLength={1000}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Hỏi về phim, suất chiếu, vé"
                  className="min-w-0 flex-1 rounded border border-outline bg-surface px-2 py-1 text-sm"
                />
                <button
                  type="submit"
                  disabled={sending || draft.trim().length === 0}
                  className="rounded bg-primary-container px-3 py-1 text-sm text-on-primary-container disabled:opacity-50"
                >
                  Gửi
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
      <button
        type="button"
        className="rounded-full bg-primary-container px-4 py-2 text-on-primary-container shadow"
        onClick={() => setOpen((current) => !current)}
      >
        {open ? 'Đóng trợ lý' : 'Trợ lý'}
      </button>
    </div>
  );
}
