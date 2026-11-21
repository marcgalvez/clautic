import { useState } from 'react';
import { rpc, useRpc } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { fmtDate, timeAgo } from '@/lib/format';
import { levelTitle } from '@/lib/levels';
import { LINES, type AvatarCfg } from '@/lib/types';
import { Avatar, AVATAR_LABELS, AVATAR_OPTIONS } from '@/components/Avatar';
import { useStudent } from '@/components/Shells';
import type { Report } from '@/components/StudentReport';
import { useSession } from '@/lib/session';

export default function ProfilePage() {
  const { dash, reload } = useStudent();
  const { signOut } = useSession();
  const toast = useToast();
  const [av, setAv] = useState<AvatarCfg>(dash.student.avatar);
  const [busy, setBusy] = useState(false);
  const rep = useRpc<Report>('student_report', { p_student_id: dash.student.id });
  const dirty = JSON.stringify(av) !== JSON.stringify(dash.student.avatar);

  async function save() {
    setBusy(true);
    try { await rpc('save_avatar', { p_avatar: av }); toast({ kind: 'ok', text: 'Avatar desat!' }); reload(true); }
    catch (e) { toast({ kind: 'error', text: (e as Error).message }); } finally { setBusy(false); }
  }
  const Opt = ({ k }: { k: keyof typeof AVATAR_OPTIONS }) => (
    <div className="flex flex-wrap gap-1.5">
      {AVATAR_OPTIONS[k].map((v) => {
        const on = av[k] === v;
        const isColor = v.startsWith('#');
        return (
          <button key={v} onClick={() => setAv((a) => ({ ...a, [k]: v }))} aria-label={AVATAR_LABELS[v] ?? v}
            className={isColor ? `h-9 w-9 rounded-full ${on ? 'ring-2 ring-white ring-offset-2 ring-offset-night-800' : ''}` : `rounded-lg px-2.5 py-1.5 text-xs font-semibold ${on ? 'bg-cian text-night-900' : 'bg-white/5 hover:bg-white/10'}`}
            style={isColor ? { background: v } : undefined}>
            {isColor ? '' : AVATAR_LABELS[v] ?? v}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <div className="glass p-5">
        <div className="flex flex-col items-center">
          <Avatar cfg={av} seed={dash.student.id} size={150} ring="#22D3EE" />
          <h1 className="mt-3 font-display text-2xl font-bold">{dash.student.first_name}</h1>
          <p className="text-sm text-violet-soft">Nivell {dash.level} · {levelTitle(dash.level)}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-1">
            {dash.groups.map((g) => <span key={g.code} className="chip text-white" style={{ background: LINES[g.line].color }}>{g.code}</span>)}
            <span className="chip bg-white/10">🗓️ {dash.student.years} {dash.student.years === 1 ? 'any' : 'anys'} a ClauTIC</span>
          </div>
        </div>
        <div className="mt-5 space-y-3">
          <div><p className="label">Pell</p><Opt k="skin" /></div>
          <div><p className="label">Vestit</p><Opt k="suit" /></div>
          <div><p className="label">Visor</p><Opt k="visor" /></div>
          <div><p className="label">Cap</p><Opt k="helmet" /></div>
          <div><p className="label">Antenes</p><Opt k="antenna" /></div>
          <div><p className="label">Expressió</p><Opt k="face" /></div>
        </div>
        <button className="btn-primary mt-5 w-full" disabled={!dirty || busy} onClick={save}>Desa l’avatar</button>
        <button className="btn-ghost mt-2 w-full md:hidden" onClick={signOut}>Surt</button>
      </div>
      <div className="space-y-4">
        <div className="glass p-5">
          <h2 className="font-display text-lg font-semibold">Els meus reconeixements</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {dash.recent.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-xl bg-white/5 p-2.5">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl text-2xl" style={{ background: `${r.competency?.color ?? '#22D3EE'}26` }}>{r.competency?.icon ?? (r.source === 'assistencia' ? '✅' : r.source === 'missio' ? '🎯' : '🏆')}</span>
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{r.label}</div><div className="text-xs text-ice/50">{timeAgo(r.created_at)}</div></div>
                <span className="font-display font-bold text-cian">+{r.xp}</span>
              </li>
            ))}
          </ul>
        </div>
        {rep.data && (
          <div className="glass p-5">
            <h2 className="font-display text-lg font-semibold">La meva trajectòria</h2>
            <ol className="mt-4 space-y-3 border-l-2 border-white/10 pl-5">
              {rep.data.timeline.map((e, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[33px] flex h-7 w-7 items-center justify-center rounded-full bg-night-700 ring-2 ring-cian/50">{e.icon}</span>
                  <div className="text-xs text-ice/50">{fmtDate(e.date, true)}</div>
                  <div className="text-sm font-medium">{e.title}</div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
