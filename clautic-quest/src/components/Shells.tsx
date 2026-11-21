import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { useSession } from '@/lib/session';
import { useRpc } from '@/lib/api';
import { useActiveGroup } from '@/lib/useGroup';
import { levelTitle } from '@/lib/levels';
import { LINES, type AvatarCfg, type BadgeLite, type GroupLite, type HouseCfg, type Recognition } from '@/lib/types';
import { Avatar } from './Avatar';
import { Coin, Progress, Spinner, ErrorBox, XpIcon } from './ui';

export function Logo({ compact, light }: { compact?: boolean; light?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2" aria-label="ClauTIC Quest, inici">
      <svg width="34" height="34" viewBox="0 0 64 64" aria-hidden>
        <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FF5A6E" /><stop offset="1" stopColor="#B5132A" /></linearGradient></defs>
        <path d="M32 4 56 18v28L32 60 8 46V18z" fill="url(#lg)" />
        <path d="M32 4 56 18 32 32 8 18z" fill="#FF8394" />
        <path d="M32 32v28L8 46V18z" fill="#C81E36" />
        <circle cx="32" cy="32" r="7" fill="#22D3EE" />
        <circle cx="32" cy="32" r="12" fill="none" stroke="#22D3EE" strokeOpacity=".5" strokeWidth="2" />
      </svg>
      {!compact && (
        <span className={`font-display text-lg font-bold leading-none ${light ? 'text-slate-800' : 'text-white'}`}>
          Clau<span className="text-brand">TIC</span> <span className={light ? 'text-violet-600' : 'text-cian'}>Quest</span>
        </span>
      )}
    </Link>
  );
}

// ───────────── Alumne ─────────────
export interface StudentDash {
  student: { id: string; first_name: string; name: string; avatar: AvatarCfg; start_year: number; years: number };
  xp: number; coins: number; level: number; level_xp: number; next_level_xp: number;
  recent: Recognition[]; badges: BadgeLite[]; house: HouseCfg; inventory: string[];
  groups: { code: string; name: string; line: keyof typeof LINES }[];
}
export type StudentOutlet = { dash: StudentDash; reload: (silent?: boolean) => Promise<void> };
export const useStudent = () => useOutletContext<StudentOutlet>();

const STUDENT_NAV = [
  { to: '/ciutat', icon: '🏙️', label: 'Ciutat', end: true },
  { to: '/ciutat/casa', icon: '🏠', label: 'Casa' },
  { to: '/ciutat/botiga', icon: '🛍️', label: 'Botiga' },
  { to: '/ciutat/museu', icon: '🏅', label: 'Museu' },
  { to: '/ciutat/jo', icon: '🧑‍🚀', label: 'Jo' },
];

export function StudentShell() {
  const { data, error, loading, reload } = useRpc<StudentDash>('my_dashboard');
  const { signOut } = useSession();
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const [prevLevel, setPrevLevel] = useState<number | null>(null);

  useEffect(() => {
    if (!data) return;
    const key = `cq-level-${data.student.id}`;
    let seen = 0;
    try { seen = Number(localStorage.getItem(key) || 0); } catch { /* */ }
    if (seen && data.level > seen) setLevelUp(data.level);
    try { localStorage.setItem(key, String(data.level)); } catch { /* */ }
    setPrevLevel(data.level);
  }, [data]);

  if (loading && !data) return <Spinner label="Entrant a ClauTIC City…" />;
  if (error || !data) return <ErrorBox error={error ?? 'Error'} onRetry={() => reload()} />;
  const pct = Math.round(((data.xp - data.level_xp) / Math.max(1, data.next_level_xp - data.level_xp)) * 100);

  return (
    <div className="min-h-screen pb-24 md:pb-6">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-night-900/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-2 md:px-6">
          <Logo compact />
          <Link to="/ciutat/jo" className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1 hover:bg-white/5">
            <Avatar cfg={data.student.avatar} seed={data.student.id} size={44} ring="#22D3EE" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-display font-semibold">{data.student.first_name}</span>
                <span className="chip bg-violet/25 text-violet-soft">Nv {data.level}</span>
                <span className="hidden text-xs text-ice/50 sm:inline">{levelTitle(data.level)}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Progress pct={pct} className="h-2 max-w-[220px]" />
                <span className="whitespace-nowrap text-[11px] text-ice/50">{data.next_level_xp - data.xp} XP</span>
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl bg-cian/10 px-2.5 py-1.5 font-display font-bold text-cian ring-1 ring-cian/30" title="Experiència (XP)">
              <XpIcon /> {data.xp}
            </div>
            <Link to="/ciutat/botiga" className="flex items-center gap-1 rounded-xl bg-amber-400/10 px-2.5 py-1.5 font-display font-bold text-amber-300 ring-1 ring-amber-400/30" title="ClauCoins">
              <Coin /> {data.coins}
            </Link>
            <button onClick={signOut} className="hidden rounded-lg p-2 text-ice/50 hover:bg-white/10 md:block" title="Surt" aria-label="Surt">⏻</button>
          </div>
        </div>
        <nav className="mx-auto hidden max-w-6xl gap-1 px-6 pb-2 md:flex">
          {STUDENT_NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => `rounded-xl px-4 py-1.5 text-sm font-semibold transition ${isActive ? 'bg-cian text-night-900' : 'text-ice/70 hover:bg-white/10'}`}>
              {n.icon} {n.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-3 py-4 md:px-6">
        <Outlet context={{ dash: data, reload } satisfies StudentOutlet} />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-white/10 bg-night-900/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden">
        {STUDENT_NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}
            className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${isActive ? 'text-cian' : 'text-ice/60'}`}>
            <span className="text-2xl leading-none">{n.icon}</span>{n.label}
          </NavLink>
        ))}
      </nav>
      {levelUp && prevLevel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-night-950/80 p-6 backdrop-blur" onClick={() => setLevelUp(null)}>
          <div className="glass-strong animate-pop p-8 text-center shadow-glow-violet">
            <div className="text-6xl">🚀</div>
            <p className="mt-2 text-sm uppercase tracking-[.3em] text-cian">Pujada de nivell</p>
            <p className="font-display text-6xl font-bold text-white">Nivell {levelUp}</p>
            <p className="mt-1 text-ice/70">Ara ets {levelTitle(levelUp)}! S’han desbloquejat noves decoracions a la botiga.</p>
            <button className="btn-primary mt-5" onClick={() => setLevelUp(null)}>Genial!</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────── Professorat ─────────────
export type TeacherOutlet = { groups: GroupLite[]; groupId: string | null; group: GroupLite | null; select: (id: string) => void };
export const useTeacher = () => useOutletContext<TeacherOutlet>();

export function GroupPicker({ groups, groupId, select }: Pick<TeacherOutlet, 'groups' | 'groupId' | 'select'>) {
  return (
    <div className="scrollbar-thin flex gap-1.5 overflow-x-auto pb-1">
      {groups.map((g) => {
        const active = g.id === groupId;
        const c = LINES[g.line].color;
        return (
          <button key={g.id} onClick={() => select(g.id)}
            className={`shrink-0 rounded-xl px-3.5 py-2 font-display text-sm font-bold transition ${active ? 'text-white shadow-lg' : 'bg-white/5 text-ice/70 hover:bg-white/10'}`}
            style={active ? { background: c, boxShadow: `0 0 20px ${c}66` } : undefined}
            title={`${g.name}${g.schedule ? ' · ' + g.schedule : ''}`}>
            {g.code}<span className="ml-1.5 text-xs font-normal opacity-75">{g.students}</span>
          </button>
        );
      })}
    </div>
  );
}

export function TeacherShell() {
  const { ctx, signOut, hasRole } = useSession();
  const ag = useActiveGroup();
  const loc = useLocation();
  const nav = [
    { to: '/profe', label: 'Mode Classe', icon: '⚡', end: true },
    { to: '/profe/assistencia', label: 'Assistència', icon: '✅' },
    { to: '/profe/missions', label: 'Missions', icon: '🎯' },
    { to: '/profe/equilibri', label: 'Equilibri', icon: '⚖️' },
    { to: '/profe/ciutat', label: 'Ciutat', icon: '🏙️' },
  ];
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-night-900/85 backdrop-blur-lg">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2 md:px-6">
          <Logo compact />
          <nav className="scrollbar-thin flex flex-1 gap-1 overflow-x-auto">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}
                className={({ isActive }) => `whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition ${isActive ? 'bg-white/10 text-white ring-1 ring-cian/50' : 'text-ice/60 hover:bg-white/5'}`}>
                <span className="mr-1">{n.icon}</span><span className={loc.pathname === n.to ? '' : 'hidden sm:inline'}>{n.label}</span>
              </NavLink>
            ))}
          </nav>
          {hasRole('admin') && <Link to="/admin" className="btn-ghost hidden py-2 md:inline-flex">⚙️ Admin</Link>}
          <span className="hidden text-sm text-ice/60 lg:inline">{ctx?.full_name}</span>
          <button onClick={signOut} className="rounded-lg p-2 text-ice/50 hover:bg-white/10" title="Surt" aria-label="Surt">⏻</button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-3 py-4 md:px-6">
        {ag.groups.length === 0 ? (
          <div className="glass p-8 text-center text-ice/70">Encara no tens cap grup assignat. Demana a l’administració que te n’assigni.</div>
        ) : (
          <Outlet context={ag satisfies TeacherOutlet} />
        )}
      </main>
    </div>
  );
}

// ───────────── Administració ─────────────
const ADMIN_NAV: { section: string; items: { to: string; label: string; icon: string }[] }[] = [
  { section: 'General', items: [
    { to: '/admin', label: 'Tauler', icon: '📊' },
    { to: '/profe', label: 'Mode Classe', icon: '⚡' },
  ] },
  { section: 'Persones', items: [
    { to: '/admin/alumnes', label: 'Alumnes', icon: '🧑‍🎓' },
    { to: '/admin/professors', label: 'Professors', icon: '🧑‍🏫' },
    { to: '/admin/families', label: 'Famílies', icon: '👨‍👩‍👧' },
    { to: '/admin/invitacions', label: 'Invitacions', icon: '🎟️' },
  ] },
  { section: 'Acadèmia', items: [
    { to: '/admin/grups', label: 'Grups', icon: '🧩' },
    { to: '/admin/config/cursos', label: 'Cursos i barris', icon: '📅' },
    { to: '/admin/activitats', label: 'Activitats', icon: '🏆' },
  ] },
  { section: 'Gamificació', items: [
    { to: '/admin/config/punts', label: 'Punts i accions', icon: '⚡' },
    { to: '/admin/config/competencies', label: 'Competències', icon: '🧭' },
    { to: '/admin/config/missions', label: 'Missions', icon: '🎯' },
    { to: '/admin/config/insignies', label: 'Insígnies', icon: '🏅' },
    { to: '/admin/config/botiga', label: 'Botiga', icon: '🛍️' },
    { to: '/admin/moviments', label: 'Moviments', icon: '📜' },
  ] },
];

export function AdminShell() {
  const { ctx, signOut } = useSession();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  return (
    <div className="min-h-screen md:flex">
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-white/10 bg-night-950/95 backdrop-blur-lg transition md:sticky md:top-0 md:h-screen md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-full flex-col">
          <div className="px-5 py-4"><Logo /></div>
          <nav className="scrollbar-thin flex-1 space-y-5 overflow-y-auto px-3 pb-4">
            {ADMIN_NAV.map((s) => (
              <div key={s.section}>
                <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-widest text-ice/35">{s.section}</div>
                {s.items.map((i) => (
                  <NavLink key={i.to} to={i.to} end={i.to === '/admin'}
                    className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-cian/15 text-cian' : 'text-ice/70 hover:bg-white/5'}`}>
                    <span className="w-5 text-center">{i.icon}</span>{i.label}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
          <div className="border-t border-white/10 p-4 text-sm">
            <div className="truncate font-semibold">{ctx?.full_name}</div>
            <div className="text-xs text-ice/50">Administració · {ctx?.academic_year?.name}</div>
            <button onClick={signOut} className="btn-ghost mt-3 w-full">Surt</button>
          </div>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setOpen(false)} />}
      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/10 bg-night-900/85 px-4 py-2 backdrop-blur md:hidden">
          <button className="rounded-lg p-2 hover:bg-white/10" onClick={() => setOpen(true)} aria-label="Menú">☰</button>
          <Logo />
        </div>
        <main className="mx-auto max-w-7xl px-4 py-6 md:px-8"><Outlet /></main>
      </div>
    </div>
  );
}

// ───────────── Famílies (tema clar i sobri) ─────────────
export function FamilyShell() {
  const { ctx, signOut } = useSession();
  const navigate = useNavigate();
  useEffect(() => {
    document.body.classList.add('theme-light');
    return () => document.body.classList.remove('theme-light');
  }, []);
  return (
    <div className="theme-light min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-800">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Logo light />
          <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 sm:inline">Portal de famílies</span>
          <div className="flex-1" />
          <button className="text-sm font-medium text-slate-600 hover:text-slate-900" onClick={() => navigate('/familia/competencies')}>Què reconeixem?</button>
          <span className="hidden text-sm text-slate-500 md:inline">{ctx?.full_name}</span>
          <button onClick={signOut} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Surt</button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6"><Outlet /></main>
      <footer className="mx-auto max-w-5xl px-4 pb-8 text-center text-xs text-slate-400">
        ClauTIC Quest reconeix l’esforç i el progrés personal. Els punts no són notes acadèmiques i no comparem els alumnes entre ells.
      </footer>
    </div>
  );
}
