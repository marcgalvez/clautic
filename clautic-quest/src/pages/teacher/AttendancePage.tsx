// Assistència ràpida: "Tots presents" i després les excepcions. Confirmar = XP automàtics.
import { useEffect, useMemo, useState } from 'react';
import { rpc, useRpc } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { fmtDate, today } from '@/lib/format';
import type { AvatarCfg } from '@/lib/types';
import { GroupPicker, useTeacher } from '@/components/Shells';
import { Avatar } from '@/components/Avatar';
import { ErrorBox, Spinner } from '@/components/ui';

type Status = 'present' | 'justificada' | 'injustificada';
interface SessionData {
  session: { id: string; confirmed_at: string | null } | null;
  xp: number;
  students: { id: string; name: string; avatar: AvatarCfg; status: Status | null }[];
  recent: { date: string; confirmed: boolean; present: number; total: number }[];
}
const STATES: { s: Status; label: string; short: string; cls: string }[] = [
  { s: 'present', label: 'Present', short: '✓', cls: 'bg-mint text-night-900' },
  { s: 'justificada', label: 'Justificada', short: 'J', cls: 'bg-amber-400 text-night-900' },
  { s: 'injustificada', label: 'No justificada', short: '✕', cls: 'bg-brand text-white' },
];

export default function AttendancePage() {
  const { groups, groupId, select } = useTeacher();
  const toast = useToast();
  const [date, setDate] = useState(today());
  const { data, error, loading, reload } = useRpc<SessionData>(groupId ? 'get_session' : null, { p_group_id: groupId, p_date: date }, [groupId, date]);
  const [marks, setMarks] = useState<Record<string, Status | null>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setMarks(Object.fromEntries(data.students.map((s) => [s.id, s.status])));
  }, [data]);

  const counts = useMemo(() => {
    const v = Object.values(marks);
    return { present: v.filter((x) => x === 'present').length, pending: v.filter((x) => !x).length, total: v.length };
  }, [marks]);

  async function save(confirm: boolean) {
    if (!groupId) return;
    setBusy(true);
    try {
      const entries = Object.entries(marks).map(([student_id, status]) => ({ student_id, status: status ?? 'present' }));
      const r = await rpc<{ present: number; awarded: number }>('save_attendance', { p_group_id: groupId, p_date: date, p_entries: entries, p_confirm: confirm });
      toast({ kind: 'ok', text: confirm ? `Sessió confirmada: ${r.present} presents${r.awarded ? ` · +${data?.xp ?? 5} XP a ${r.awarded}` : ''}` : 'Esborrany desat' });
      reload(true);
    } catch (e) { toast({ kind: 'error', text: (e as Error).message }); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <GroupPicker groups={groups} groupId={groupId} select={select} />
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Assistència</h1>
          <p className="text-sm text-ice/60">Marca tots els presents d’un sol cop i després només les excepcions.</p>
        </div>
        <div className="flex-1" />
        <input type="date" className="input w-auto" value={date} max={today()} onChange={(e) => setDate(e.target.value)} aria-label="Data de la sessió" />
      </div>

      {loading && !data ? <Spinner /> : error ? <ErrorBox error={error} onRetry={() => reload()} /> : data && (
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className="glass p-3">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button className="btn-cian py-3 text-base" onClick={() => setMarks(Object.fromEntries(data.students.map((s) => [s.id, 'present'])))}>✓ Tots presents</button>
              <span className="text-sm text-ice/60">{counts.present}/{counts.total} presents{counts.pending ? ` · ${counts.pending} sense marcar` : ''}</span>
              {data.session?.confirmed_at && <span className="chip ml-auto bg-mint/15 text-mint">Confirmada {fmtDate(data.session.confirmed_at)}</span>}
            </div>
            <ul className="divide-y divide-white/5">
              {data.students.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2">
                  <Avatar cfg={s.avatar} seed={s.id} size={40} />
                  <span className="flex-1 font-medium">{s.name}</span>
                  <div className="flex gap-1" role="radiogroup" aria-label={`Assistència de ${s.name}`}>
                    {STATES.map((st) => (
                      <button key={st.s} role="radio" aria-checked={marks[s.id] === st.s} title={st.label}
                        onClick={() => setMarks((m) => ({ ...m, [s.id]: st.s }))}
                        className={`h-11 w-11 rounded-xl text-base font-bold transition active:scale-90 sm:w-auto sm:px-3 ${marks[s.id] === st.s ? st.cls : 'bg-white/5 text-ice/50 hover:bg-white/10'}`}>
                        <span className="sm:hidden">{st.short}</span><span className="hidden text-sm sm:inline">{st.label}</span>
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            <div className="sticky bottom-0 mt-3 flex flex-wrap justify-end gap-2 bg-night-800/90 pt-3 backdrop-blur">
              <button className="btn-ghost" disabled={busy} onClick={() => save(false)}>Desa esborrany</button>
              <button className="btn-primary px-6 py-3 text-base" disabled={busy || counts.pending > 0} onClick={() => save(true)}>
                {data.session?.confirmed_at ? 'Actualitza la sessió' : `Confirma la sessió (+${data.xp} XP)`}
              </button>
            </div>
          </div>
          <aside className="glass h-fit p-4">
            <h3 className="font-display font-semibold">Últimes sessions</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {data.recent.map((r) => (
                <li key={r.date}>
                  <button className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 hover:bg-white/5 ${r.date === date ? 'bg-white/10' : ''}`} onClick={() => setDate(r.date)}>
                    <span>{fmtDate(r.date)}</span>
                    <span className="text-ice/60">{r.present}/{r.total} {r.confirmed ? '✓' : '…'}</span>
                  </button>
                </li>
              ))}
              {!data.recent.length && <li className="text-ice/50">Encara no hi ha sessions.</li>}
            </ul>
            <p className="mt-3 text-xs text-ice/40">Les absències justificades no penalitzen. Si corregeixes una sessió confirmada, els XP s’ajusten sols.</p>
          </aside>
        </div>
      )}
    </div>
  );
}
