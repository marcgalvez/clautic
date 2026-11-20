import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { BarChart3, BookOpenCheck, Dumbbell, House, Moon, Puzzle, Settings, Sun } from 'lucide-react';
import { useData } from '@/state/DataProvider';
import { cn } from '@/lib/utils';
import type { MessageKey } from '@/i18n';

const NAV: { to: string; key: MessageKey; icon: typeof House }[] = [
  { to: '/', key: 'nav.home', icon: House },
  { to: '/entrenar', key: 'nav.train', icon: Dumbbell },
  { to: '/exercicis', key: 'nav.exercises', icon: Puzzle },
  { to: '/analisi', key: 'nav.analysis', icon: BookOpenCheck },
  { to: '/progres', key: 'nav.progress', icon: BarChart3 },
];

function ThemeToggle() {
  const { data, updateSettings, t } = useData();
  const isDark =
    data.settings.theme === 'dark' ||
    (data.settings.theme === 'system' && typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  return (
    <button
      type="button"
      onClick={() => updateSettings({ theme: isDark ? 'light' : 'dark' })}
      className="flex size-9 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      aria-label={t('theme.toggle')}
      title={t('theme.toggle')}
      data-theme={data.settings.theme}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

export function AppShell() {
  const { t, saveError } = useData();
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_1fr]">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-card/60 p-4 lg:flex">
        <Brand />
        <nav className="mt-6 flex flex-col gap-1" aria-label="Navegació principal">
          {NAV.map(({ to, key, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )
              }
            >
              <Icon className="size-4" />
              {t(key)}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex items-center justify-between">
          <NavLink to="/configuracio" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
            <Settings className="size-4" /> {t('nav.settings')}
          </NavLink>
          <ThemeToggle />
        </div>
      </aside>

      {/* Top bar (mobile/tablet) */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/90 px-4 py-2.5 backdrop-blur lg:hidden">
        <Brand />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <NavLink to="/configuracio" aria-label={t('nav.settings')} className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
            <Settings className="size-4" />
          </NavLink>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pt-5 pb-24 sm:px-6 lg:px-8 lg:pt-8 lg:pb-10">
        {saveError && <div className="mb-4 rounded-md bg-danger/10 p-3 text-sm text-danger">{saveError}</div>}
        <Suspense fallback={<p className="text-muted-foreground">Carregant…</p>}>
          <Outlet />
        </Suspense>
      </main>

      {/* Bottom nav (mobile/tablet) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        aria-label="Navegació principal"
      >
        {NAV.map(({ to, key, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn('flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium', isActive ? 'text-primary' : 'text-muted-foreground')
            }
          >
            <Icon className="size-5" />
            <span className="max-w-full truncate px-1">{t(key).split(' ')[0]}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function Brand() {
  return (
    <NavLink to="/" className="flex items-center gap-2">
      <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-8" />
      <span className="text-lg font-bold tracking-tight">
        Chess<span className="text-primary">Lab</span>
      </span>
    </NavLink>
  );
}
