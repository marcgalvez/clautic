// Informe complet d'un alumne: famílies (tema clar), professorat i administració.
import { Link } from 'react-router-dom';
import { useRpc } from '@/lib/api';
import { fmtDate, MONTHS, timeAgo } from '@/lib/format';
import { levelTitle } from '@/lib/levels';
import { LINES, SOURCE_LABEL, type AvatarCfg, type BadgeLite, type HouseCfg, type Line, type Recognition } from '@/lib/types';
import { Avatar } from './Avatar';
import { HouseView } from './House';
import { ErrorBox, Spinner } from './ui';

export interface Report {
  student: { id: string; first_name: string; last_name: string; avatar: AvatarCfg; start_year: number; years: number; birth_year: number | null };
  xp: number; coins: number; level: number; level_xp: number; next_level_xp: number; xp_this_year: number;
  groups: { code: string; name: string; line: Line }[];
  attendance: { present: number; justificada: number; injustificada: number; total: number };
  badges: BadgeLite[];
  recent: Recognition[];
  competencies: { id: string; key: string; name: string; icon: string; color: string; description: string; family_explanation: string; total: number; months: { month: string; count: number }[] }[];
  activities: { name: string; kind: string; date: string; role: string; description: string }[];
  missions: { title: string; icon: string; kind: string; line: Line | null; date: string }[];
  timeline: { date: string; type: string; title: string; icon: string }[];
  house: HouseCfg;
}

const ROLE_TXT: Record<string, string> = { participa: 'Hi ha participat', collabora: 'Hi ha col·laborat', destaca: 'Resultat destacat' };

export function StudentReport({ studentId, light, houseLink }: { studentId: string; light?: boolean; houseLink?: string }) {
  const { data: r, error, loading, reload } = useRpc<Report>('student_report', { p_student_id: studentId }, [studentId]);
  if (loading && !r) return <Spinner />;
  if (error || !r) return <ErrorBox error={error ?? 'Error'} onRetry={() => reload()} />;

  const t = light
    ? { card: 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm', muted: 'text-slate-500', strong: 'text-slate-900', soft: 'bg-slate-50', bar: 'bg-slate-100', line: 'border-slate-200' }
    : { card: 'glass p-5', muted: 'text-ice/55', strong: 'text-white', soft: 'bg-white/5', bar: 'bg-white/10', line: 'border-white/10' };
  const att = r.attendance;
  const attPct = att.total ? Math.round((att.present / att.total) * 100) : null;
  const pct = Math.round(((r.xp - r.level_xp) / Math.max(1, r.next_level_xp - r.level_xp)) * 100);
  const maxComp = Math.max(1, ...r.competencies.map((c) => c.total));
  const top = [...r.competencies].sort((a, b) => b.total - a.total).slice(0, 3).filter((c) => c.total > 0);

  return (
    <div className="space-y-4 print:space-y-3">
      {/* Capçalera */}
      <div className={`${t.card} flex flex-col gap-5 md:flex-row md:items-center`}>
        <Avatar cfg={r.student.avatar} seed={r.student.id} size={96} ring={light ? '#8B5CF6' : '#22D3EE'} />
        <div className="min-w-0 flex-1">
          <h2 className={`font-display text-2xl font-bold ${t.strong}`}>{r.student.first_name} {r.student.last_name}</h2>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {r.groups.map((g) => <span key={g.code} className="chip text-white" style={{ background: LINES[g.line].color }}>{LINES[g.line].icon} {g.code}</span>)}
            <span className={`chip ${light ? 'bg-violet-100 text-violet-700' : 'bg-violet/20 text-violet-soft'}`}>Nivell {r.level} · {levelTitle(r.level)}</span>
          </div>
          <div className="mt-3 max-w-md">
            <div className={`mb-1 flex justify-between text-xs ${t.muted}`}><span>{r.xp} XP acumulats</span><span>{r.next_level_xp - r.xp} XP per al nivell {r.level + 1}</span></div>
            <div className={`h-2.5 overflow-hidden rounded-full ${t.bar}`}><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" style={{ width: `${pct}%` }} /></div>
          </div>
        </div>
        <div className="flex gap-2 print:hidden">
          {houseLink && <Link to={houseLink} className={light ? 'rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50' : 'btn-ghost'}>🏠 Veure la casa</Link>}
          <button onClick={() => window.print()} className={light ? 'rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50' : 'btn-ghost'}>🖨️ Informe</button>
        </div>
      </div>

      {/* Xifres clau */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { l: 'Nivell', v: r.level, i: '⚡', c: '#8B5CF6' },
          { l: 'XP aquest curs', v: r.xp_this_year, i: '📈', c: '#22D3EE' },
          { l: 'Assistència', v: attPct === null ? '—' : `${attPct}%`, i: '✅', c: '#34D399', h: att.total ? `${att.present} de ${att.total} sessions` : 'Sense sessions' },
          { l: 'Anys a ClauTIC', v: r.student.years, i: '🗓️', c: '#FBBF24', h: `Des de ${r.student.start_year}` },
          { l: 'Insígnies', v: r.badges.length, i: '🏅', c: '#E5213B' },
        ].map((s) => (
          <div key={s.l} className={t.card + ' !p-4'}>
            <div className={`text-xs font-semibold uppercase tracking-wider ${t.muted}`}>{s.i} {s.l}</div>
            <div className="mt-1 font-display text-3xl font-bold" style={{ color: s.c }}>{s.v}</div>
            {s.h && <div className={`text-xs ${t.muted}`}>{s.h}</div>}
          </div>
        ))}
      </div>
      {att.total > 0 && (att.justificada > 0 || att.injustificada > 0) && (
        <p className={`text-xs ${t.muted}`}>Absències aquest curs: {att.justificada} justificades, {att.injustificada} no justificades. Les absències justificades no tenen cap efecte negatiu.</p>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Reconeixements recents */}
        <section className={`${t.card} lg:col-span-3`}>
          <h3 className={`font-display text-lg font-semibold ${t.strong}`}>Reconeixements recents</h3>
          {top.length > 0 && (
            <p className={`mt-1 text-sm ${t.muted}`}>On més destaca: {top.map((c) => `${c.icon} ${c.name}`).join(', ')}.</p>
          )}
          <ul className="mt-3 space-y-2">
            {r.recent.slice(0, 12).map((m) => (
              <li key={m.id} className={`flex gap-3 rounded-xl p-3 ${t.soft}`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl" style={{ background: `${m.competency?.color ?? '#94A3B8'}22` }}>
                  {m.competency?.icon ?? (m.source === 'assistencia' ? '✅' : m.source === 'missio' ? '🎯' : m.source === 'activitat' ? '🏆' : m.source.includes('insignia') || m.source === 'antiguitat' ? '🏅' : '⭐')}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className={`font-semibold ${t.strong}`}>{m.label}</span>
                    <span className={`text-xs ${t.muted}`}>{timeAgo(m.created_at)} · +{m.xp} XP</span>
                  </div>
                  {light && m.competency && <p className={`mt-0.5 text-sm ${t.muted}`}>{m.competency.family_explanation}</p>}
                  {!light && <p className={`text-xs ${t.muted}`}>{SOURCE_LABEL[m.source] ?? m.source}{m.note ? ` · ${m.note}` : ''}</p>}
                </div>
              </li>
            ))}
            {!r.recent.length && <li className={`text-sm ${t.muted}`}>Encara no hi ha reconeixements.</li>}
          </ul>
        </section>

        {/* Competències */}
        <section className={`${t.card} lg:col-span-2`}>
          <h3 className={`font-display text-lg font-semibold ${t.strong}`}>Evolució de les competències</h3>
          <p className={`text-xs ${t.muted}`}>Reconeixements rebuts per competència (últims 6 mesos)</p>
          <ul className="mt-3 space-y-3">
            {r.competencies.map((c) => {
              const mmax = Math.max(1, ...c.months.map((m) => m.count));
              return (
                <li key={c.key} title={light ? c.family_explanation : c.description}>
                  <div className="flex items-center gap-2 text-sm">
                    <span>{c.icon}</span><span className={`flex-1 font-medium ${t.strong}`}>{c.name}</span>
                    <div className="flex h-5 items-end gap-0.5">
                      {c.months.map((m) => <span key={m.month} className="w-2 rounded-sm" title={`${MONTHS[Number(m.month.slice(5)) - 1]}: ${m.count}`} style={{ height: `${(m.count / mmax) * 100}%`, minHeight: 2, background: m.count ? c.color : light ? '#E2E8F0' : 'rgba(255,255,255,.1)' }} />)}
                    </div>
                    <span className={`w-8 text-right font-semibold tabular-nums ${t.strong}`}>{c.total}</span>
                  </div>
                  <div className={`mt-1 h-1.5 overflow-hidden rounded-full ${t.bar}`}><div className="h-full rounded-full" style={{ width: `${(c.total / maxComp) * 100}%`, background: c.color }} /></div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className={t.card}>
          <h3 className={`font-display text-lg font-semibold ${t.strong}`}>Insígnies</h3>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {r.badges.map((b) => (
              <div key={b.key} className={`flex flex-col items-center rounded-xl p-2 text-center ${t.soft}`} title={b.description}>
                <span className="flex h-11 w-11 items-center justify-center rounded-full text-2xl" style={{ background: `${b.color}26`, boxShadow: `inset 0 0 0 2px ${b.color}` }}>{b.icon}</span>
                <span className={`mt-1 text-[11px] font-semibold leading-tight ${t.strong}`}>{b.name}</span>
              </div>
            ))}
          </div>
          {!r.badges.length && <p className={`mt-2 text-sm ${t.muted}`}>Encara cap insígnia.</p>}
        </section>
        <section className={t.card}>
          <h3 className={`font-display text-lg font-semibold ${t.strong}`}>Activitats extraordinàries</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {r.activities.map((a) => (
              <li key={a.name + a.date} className={`rounded-xl p-3 ${t.soft}`}>
                <div className={`font-semibold ${t.strong}`}>🏆 {a.name}</div>
                <div className={`text-xs ${t.muted}`}>{fmtDate(a.date, true)} · {ROLE_TXT[a.role] ?? a.role}</div>
              </li>
            ))}
            {!r.activities.length && <li className={t.muted}>Encara no ha participat en cap activitat.</li>}
          </ul>
          <p className={`mt-2 text-xs ${t.muted}`}>Participar sempre suma, independentment del resultat.</p>
        </section>
        <section className={t.card}>
          <h3 className={`font-display text-lg font-semibold ${t.strong}`}>Missions i projectes</h3>
          <ul className="mt-3 space-y-1.5 text-sm">
            {r.missions.slice(0, 10).map((m, i) => (
              <li key={i} className="flex items-center gap-2"><span>{m.icon}</span><span className={`flex-1 ${t.strong}`}>{m.title}</span><span className={`text-xs ${t.muted}`}>{fmtDate(m.date)}</span></li>
            ))}
            {!r.missions.length && <li className={t.muted}>Encara no ha completat cap missió.</li>}
          </ul>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className={`${t.card} lg:col-span-2`}>
          <h3 className={`font-display text-lg font-semibold ${t.strong}`}>Trajectòria a ClauTIC</h3>
          <ol className={`relative mt-4 space-y-4 border-l-2 pl-6 ${t.line}`}>
            {r.timeline.map((e, i) => (
              <li key={i} className="relative">
                <span className={`absolute -left-[37px] flex h-8 w-8 items-center justify-center rounded-full text-base ${light ? 'bg-white ring-2 ring-violet-300' : 'bg-night-700 ring-2 ring-cian/50'}`}>{e.icon}</span>
                <div className={`text-xs ${t.muted}`}>{fmtDate(e.date, true)}</div>
                <div className={`font-medium ${t.strong}`}>{e.title}</div>
              </li>
            ))}
          </ol>
        </section>
        <section className={`${t.card} flex flex-col items-center justify-center print:hidden`}>
          <h3 className={`self-start font-display text-lg font-semibold ${t.strong}`}>Casa a ClauTIC City</h3>
          <HouseView cfg={r.house} className="w-full max-w-[280px]" />
        </section>
      </div>
    </div>
  );
}
