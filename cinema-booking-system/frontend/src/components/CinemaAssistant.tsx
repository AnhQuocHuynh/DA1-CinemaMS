import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import keycloak from '../lib/keycloak';
import { authService } from '../services/authService';
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
import { useAuthStore } from '../store/authStore';
import { useChatUiStore } from '../store/chatUiStore';
import { ChatLauncher } from './chat/ChatLauncher';
import { ChatWindow } from './chat/ChatWindow';
import { useCinebotTranslation } from './chat/useCinebotTranslation';
import type { FailedChatAction } from './chat/types';

const MAX_MESSAGE_LENGTH = 500;

export function CinemaAssistant() {
  const { t, lang: currentLang } = useCinebotTranslation();
  const location = useLocation();
  const hidden =
    location.pathname.startsWith('/admin') || location.pathname.startsWith('/staff');
  const authUser = useAuthStore((s) => s.user);
  const isAuthenticated = Boolean(authUser) || Boolean(keycloak.authenticated);

  const isOpen = useChatUiStore((s) => s.isOpen);
  const isExpanded = useChatUiStore((s) => s.isExpanded);
  const activeId = useChatUiStore((s) => s.activeSessionId);
  const hasVisited = useChatUiStore((s) => s.hasVisited);
  const feedbackByMessage = useChatUiStore((s) => s.feedbackByMessage);
  const setOpen = useChatUiStore((s) => s.setOpen);
  const toggleOpen = useChatUiStore((s) => s.toggleOpen);
  const toggleExpanded = useChatUiStore((s) => s.toggleExpanded);
  const setActiveId = useChatUiStore((s) => s.setActiveSessionId);
  const markVisited = useChatUiStore((s) => s.markVisited);
  const setMessageFeedback = useChatUiStore((s) => s.setMessageFeedback);

  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [failedAction, setFailedAction] = useState<FailedChatAction | null>(null);
  const [scrollTrigger, setScrollTrigger] = useState(0);
  const [retryCounter, setRetryCounter] = useState(0);

  const skipNextFetchRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen || hidden) {
      return;
    }
    if (!isAuthenticated) {
      setSessions([]);
      setActiveId(null);
      setErrorKey(null);
      setFailedAction(null);
      return;
    }

    let cancelled = false;
    setErrorKey(null);
    setFailedAction(null);

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
        const storedId = useChatUiStore.getState().activeSessionId;
        const stillExists = storedId && next.some((item) => item.id === storedId);
        if (!stillExists) {
          setActiveId(next[0]?.id ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setErrorKey('cinebot.errors.connect');
          setFailedAction({ type: 'sessions' });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, hidden, isAuthenticated, retryCounter, setActiveId]);

  useEffect(() => {
    if (!isOpen || !activeId || !isAuthenticated || hidden) {
      return;
    }
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }

    let cancelled = false;
    setLoadingMessages(true);
    setErrorKey(null);
    setFailedAction(null);

    getSessionDetail(activeId)
      .then((detail) => {
        if (!cancelled) {
          setMessages(detail.messages ?? []);
          setScrollTrigger((n) => n + 1);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setErrorKey('cinebot.errors.loadMessages');
          setFailedAction({ type: 'messages', sessionId: activeId });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingMessages(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, activeId, isAuthenticated, hidden, retryCounter]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  if (hidden) {
    return null;
  }

  async function handleCreateSession() {
    setErrorKey(null);
    setFailedAction(null);
    try {
      const created = await createSession();
      skipNextFetchRef.current = true;
      setSessions((current) => [created, ...current]);
      setActiveId(created.id);
      setMessages([]);
    } catch {
      setErrorKey('cinebot.errors.createSession');
    }
  }

  async function handleRenameSession(sessionId: string, title: string): Promise<boolean> {
    const trimmed = title.trim();
    if (!trimmed) {
      setErrorKey('cinebot.errors.renameEmpty');
      return false;
    }
    setErrorKey(null);
    try {
      const updated = await renameSession(sessionId, trimmed);
      setSessions((current) =>
        current.map((item) => (item.id === sessionId ? { ...item, title: updated.title } : item)),
      );
      return true;
    } catch {
      setErrorKey('cinebot.errors.renameFailed');
      return false;
    }
  }

  async function handleDeleteSession(sessionId: string): Promise<boolean> {
    setErrorKey(null);
    try {
      await deleteSession(sessionId);
      const remaining = sessions.filter((item) => item.id !== sessionId);
      setSessions(remaining);
      if (activeId === sessionId) {
        setActiveId(remaining[0]?.id ?? null);
        setMessages([]);
      }
      return true;
    } catch {
      setErrorKey('cinebot.errors.deleteFailed');
      return false;
    }
  }

  async function streamTurn(
    text: string,
    options?: { replaceLastAssistant?: boolean },
  ) {
    if (!text || text.length > MAX_MESSAGE_LENGTH || sending) {
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setSending(true);
    setErrorKey(null);
    setFailedAction(null);
    if (!options?.replaceLastAssistant) {
      setDraft('');
    }
    setScrollTrigger((n) => n + 1);

    const assistantId = `local-assistant-${Date.now()}`;
    const placeholderMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      sources: [],
      createdAt: new Date().toISOString(),
    };

    if (options?.replaceLastAssistant) {
      setMessages((current) => {
        const lastIdx = current.length - 1;
        if (lastIdx >= 0 && current[lastIdx].role === 'assistant') {
          return [...current.slice(0, lastIdx), placeholderMsg];
        }
        return [...current, placeholderMsg];
      });
    } else {
      const userMsg: ChatMessage = {
        id: `local-user-${Date.now()}`,
        role: 'user',
        content: text,
        createdAt: new Date().toISOString(),
      };
      setMessages((current) => [...current, userMsg, placeholderMsg]);
    }

    let resolvedSessionId = activeId;

    try {
      await streamChatMessage(
        isAuthenticated ? activeId : null,
        text,
        (payload) => {
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
            if (isAuthenticated && payload.sessionId && payload.sessionId !== activeId) {
              skipNextFetchRef.current = true;
              resolvedSessionId = payload.sessionId;
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
                    suggestedFollowUps: payload.suggestedFollowUps,
                  };
                }
                return {
                  ...item,
                  sources: payload.sources ?? [],
                  cached: Boolean(payload.cached),
                  suggestedFollowUps: payload.suggestedFollowUps,
                };
              }),
            );
          }
        },
        currentLang,
        controller.signal,
      );

      if (isAuthenticated) {
        const currentSession = sessions.find((s) => s.id === resolvedSessionId);
        if (!currentSession || !currentSession.title) {
          listSessions()
            .then((updated) => {
              if (updated.length > 0) {
                setSessions(updated);
              }
            })
            .catch(() => { });
        }
      }
    } catch (err) {
      if ((err as { name?: string } | null)?.name === 'AbortError') {
        return;
      }
      setErrorKey('cinebot.errors.sendFailed');
      setFailedAction({ type: 'send', text });
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setSending(false);
    }
  }

  function handleStop() {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setSending(false);
  }

  function handleRegenerate() {
    if (sending) {
      return;
    }
    let lastAssistantIdx = -1;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'assistant') {
        lastAssistantIdx = i;
        break;
      }
    }
    if (lastAssistantIdx <= 0) {
      return;
    }
    for (let i = lastAssistantIdx - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'user' && messages[i].content.trim()) {
        void streamTurn(messages[i].content.trim(), { replaceLastAssistant: true });
        return;
      }
    }
  }

  function handleRetry() {
    if (!failedAction) {
      return;
    }
    if (failedAction.type === 'sessions' || failedAction.type === 'messages') {
      setErrorKey(null);
      setFailedAction(null);
      setRetryCounter((n) => n + 1);
      return;
    }
    if (failedAction.type === 'send') {
      const last = messages[messages.length - 1];
      const replaceLast = last?.role === 'assistant' && !last.content;
      void streamTurn(failedAction.text, { replaceLastAssistant: replaceLast });
    }
  }

  return (
    <>
      <ChatWindow
        isOpen={isOpen}
        isExpanded={isExpanded}
        isAuthenticated={isAuthenticated}
        sessions={sessions}
        activeId={activeId}
        messages={messages}
        draft={draft}
        maxLength={MAX_MESSAGE_LENGTH}
        sending={sending}
        loadingMessages={loadingMessages}
        error={errorKey ? t(errorKey) : ''}
        canRetry={Boolean(failedAction)}
        lang={currentLang}
        feedbackByMessage={feedbackByMessage}
        scrollTrigger={scrollTrigger}
        launcherRef={launcherRef}
        onClose={() => setOpen(false)}
        onToggleExpand={toggleExpanded}
        onNewChat={() => void handleCreateSession()}
        onSelectSession={(sessionId) => {
          setErrorKey(null);
          setFailedAction(null);
          setActiveId(sessionId);
        }}
        onRenameSession={handleRenameSession}
        onDeleteSession={handleDeleteSession}
        onClearGuest={() => {
          setMessages([]);
          setErrorKey(null);
          setFailedAction(null);
        }}
        onSignIn={() => void authService.login()}
        onDraftChange={setDraft}
        onSend={() => void streamTurn(draft.trim())}
        onStop={handleStop}
        onSelectPrompt={(prompt) => void streamTurn(prompt.trim())}
        onRegenerate={handleRegenerate}
        onFeedback={setMessageFeedback}
        onRetry={handleRetry}
      />

      <ChatLauncher
        isOpen={isOpen}
        hasVisited={hasVisited}
        onToggle={toggleOpen}
        onDismissTooltip={markVisited}
        buttonRef={launcherRef}
      />
    </>
  );
}
