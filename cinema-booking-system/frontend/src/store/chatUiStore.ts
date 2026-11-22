import { create } from 'zustand';
import type { MessageFeedback } from '../components/chat/types';

const SESSION_UI_STORAGE_KEY = 'cinebot_ui_state_v1';
const VISITED_STORAGE_KEY = 'cinebot_visited';

interface PersistedUiState {
  isOpen: boolean;
  isExpanded: boolean;
  activeSessionId: string | null;
  feedbackByMessage: Record<string, MessageFeedback>;
}

const DEFAULT_PERSISTED_STATE: PersistedUiState = {
  isOpen: false,
  isExpanded: false,
  activeSessionId: null,
  feedbackByMessage: {},
};

function readSessionUiState(): PersistedUiState {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return DEFAULT_PERSISTED_STATE;
    }
    const raw = window.sessionStorage.getItem(SESSION_UI_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_PERSISTED_STATE;
    }
    const parsed = JSON.parse(raw) as Partial<PersistedUiState>;
    return {
      isOpen: Boolean(parsed.isOpen),
      isExpanded: Boolean(parsed.isExpanded),
      activeSessionId:
        typeof parsed.activeSessionId === 'string' && parsed.activeSessionId.trim()
          ? parsed.activeSessionId
          : null,
      feedbackByMessage:
        parsed.feedbackByMessage && typeof parsed.feedbackByMessage === 'object'
          ? parsed.feedbackByMessage
          : {},
    };
  } catch {
    return DEFAULT_PERSISTED_STATE;
  }
}

function writeSessionUiState(state: PersistedUiState): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(SESSION_UI_STORAGE_KEY, JSON.stringify(state));
    }
  } catch {
    // Ignore storage quota or sandbox restrictions.
  }
}

function readHasVisited(): boolean {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(VISITED_STORAGE_KEY) === '1';
    }
  } catch {
    // Ignore storage access errors.
  }
  return false;
}

function writeHasVisited(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(VISITED_STORAGE_KEY, '1');
    }
  } catch {
    // Ignore storage access errors.
  }
}

interface ChatUiState extends PersistedUiState {
  hasVisited: boolean;
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  setExpanded: (expanded: boolean) => void;
  toggleExpanded: () => void;
  setActiveSessionId: (sessionId: string | null) => void;
  markVisited: () => void;
  setMessageFeedback: (messageId: string | number, value: MessageFeedback) => void;
}

const initialPersisted = readSessionUiState();

export const useChatUiStore = create<ChatUiState>((set, get) => {
  const persistCurrent = (next: PersistedUiState) => {
    writeSessionUiState({
      isOpen: next.isOpen,
      isExpanded: next.isExpanded,
      activeSessionId: next.activeSessionId,
      feedbackByMessage: next.feedbackByMessage,
    });
  };

  return {
    ...initialPersisted,
    hasVisited: readHasVisited(),

    setOpen: (open) => {
      if (open && !get().hasVisited) {
        writeHasVisited();
      }
      set((state) => {
        const next: PersistedUiState = {
          isOpen: open,
          isExpanded: state.isExpanded,
          activeSessionId: state.activeSessionId,
          feedbackByMessage: state.feedbackByMessage,
        };
        persistCurrent(next);
        return {
          ...next,
          hasVisited: open ? true : state.hasVisited,
        };
      });
    },

    toggleOpen: () => {
      get().setOpen(!get().isOpen);
    },

    setExpanded: (expanded) => {
      set((state) => {
        const next: PersistedUiState = {
          isOpen: state.isOpen,
          isExpanded: expanded,
          activeSessionId: state.activeSessionId,
          feedbackByMessage: state.feedbackByMessage,
        };
        persistCurrent(next);
        return next;
      });
    },

    toggleExpanded: () => {
      get().setExpanded(!get().isExpanded);
    },

    setActiveSessionId: (sessionId) => {
      set((state) => {
        const next: PersistedUiState = {
          isOpen: state.isOpen,
          isExpanded: state.isExpanded,
          activeSessionId: sessionId,
          feedbackByMessage: state.feedbackByMessage,
        };
        persistCurrent(next);
        return next;
      });
    },

    markVisited: () => {
      if (!get().hasVisited) {
        writeHasVisited();
        set({ hasVisited: true });
      }
    },

    setMessageFeedback: (messageId, value) => {
      const key = String(messageId);
      set((state) => {
        const nextFeedback = { ...state.feedbackByMessage };
        if (nextFeedback[key] === value) {
          delete nextFeedback[key];
        } else {
          nextFeedback[key] = value;
        }
        const next: PersistedUiState = {
          isOpen: state.isOpen,
          isExpanded: state.isExpanded,
          activeSessionId: state.activeSessionId,
          feedbackByMessage: nextFeedback,
        };
        persistCurrent(next);
        return next;
      });
    },
  };
});
