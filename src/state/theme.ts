import { useEffect } from 'react';
import type { AppSettings } from '@/lib/storage/types';

export function useApplyTheme(theme: AppSettings['theme']) {
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && !!mq?.matches);
      document.documentElement.classList.toggle('dark', dark);
      try {
        if (theme === 'system') localStorage.removeItem('chesslab:theme');
        else localStorage.setItem('chesslab:theme', theme);
      } catch {
        /* ignore */
      }
    };
    apply();
    mq?.addEventListener?.('change', apply);
    return () => mq?.removeEventListener?.('change', apply);
  }, [theme]);
}
