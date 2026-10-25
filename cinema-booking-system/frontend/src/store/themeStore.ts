import { create } from 'zustand';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const THEME_STORAGE_KEY = 'cinema_theme';

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (theme === 'dark' || (theme === 'system' && systemPrefersDark)) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

// Global media query listener for system theme changes
if (typeof window !== 'undefined') {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', () => {
    const currentTheme = (localStorage.getItem(THEME_STORAGE_KEY) as Theme) || 'system';
    if (currentTheme === 'system') {
      applyTheme('system');
    }
  });
}

const getInitialTheme = (): Theme => {
  if (typeof window === 'undefined') return 'system';
  const saved = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
  if (saved && (saved === 'light' || saved === 'dark' || saved === 'system')) {
    return saved;
  }
  return 'system';
};

const initialTheme = getInitialTheme();
if (typeof window !== 'undefined') {
  applyTheme(initialTheme);
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initialTheme,
  setTheme: (newTheme: Theme) => {
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    applyTheme(newTheme);
    set({ theme: newTheme });
  },
}));
