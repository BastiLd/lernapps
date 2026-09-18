import { useEffect } from 'react';
import { usePersistentState } from './storage';

export type ThemeChoice = 'system' | 'light' | 'dark';

export const THEME_KEY = 'lernapps:theme';

function apply(choice: ThemeChoice) {
  const dark = choice === 'dark' || (choice === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export function useTheme() {
  const [theme, setTheme] = usePersistentState<ThemeChoice>(THEME_KEY, 'system');
  useEffect(() => {
    apply(theme);
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);
  return [theme, setTheme] as const;
}
