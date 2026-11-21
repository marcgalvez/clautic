// MODE CLASSE: donar punts amb dos tocs (alumne → competència), sense confirmacions.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { rpc, useRpc, uuid } from '@/lib/api';
import { useToast } from '@/lib/toast';
import type { AvatarCfg, Competency, QuickAction } from '@/lib/types';
import { GroupPicker, useTeacher } from '@/components/Shells';
import { Avatar } from '@/components/Avatar';
import { ErrorBox, Spinner } from '@/components/ui';

interface BoardStudent { id: string; name: string; first_name: string; avatar: AvatarCfg; xp: number; level: number; today: number; week: number; status: string | null }
interface Board {
  group: { id: string; code: string; name: string; line: string };
  students: BoardStudent[];
  competencies: Competency[];
  quick_actions: QuickAction[];
  rules: { key: string; label: string; xp: number }[];
  session: { id: string; confirmed_at: string | null } | null;
  last_batch: { batch_id: string; label: string; count: number; at: string } | null;
}
type Float = { id: number; sid: string; text: string; color: string };

export default function ClassMode() {
  const { groups, groupId, select } = useTeacher();
  const toast = useToast();
  const { data, setData, error, loading, reload } = useRpc<Board>(groupId ? 'class_board' : null, { p_group_id: groupId }, [groupId]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [armed, setArmed] = useState<Competency | QuickAction | null>(null);
  const [pending, setPending] = useState(false);
  const [floats, setFloats] = useState<Float[]>([]);
  const [showRules, setShowRules] = useState(false);
  const [lastUndo, setLastUndo] = useState<string | null>(null);
  const floatId = useRef(0);

  useEffect(() => { setSel(new Set()); setArmed(null); }, [groupId]);

  const comps = data?.competencies ?? [];
  const qas = data?.quick_actions ?? [];
  const compById = useMemo(() => new Map(comps.map((c) => [c.id, c])), [comps]);
  const present = useMemo(() => (data?.students ?? []).filter((s) => s.status !== 'justificada' && s.status !== 'injustificada'), [data]);

  const award = useCallback(async (studentIds: string[], target: Competency | QuickAction) => {
    if (!data || !groupId || !studentIds.length || pending) return;
    const isQa = 'label' in target;
    const color = isQa ? (target.competency_id ? compById.get(target.competency_id)?.color : undefined) ?? '#22D3EE' : (target as Competency).color;
    const label = isQa ? (target as QuickAction).label : (target as Competency).name;
    setPending(true);
    // Actualització optimista
    const prev = data;
    setData({ ...data, students: data.students.map((s) => studentIds.includes(s.id) ? { ...s, today: s.today + 1, xp: s.xp + target.xp } : s) });
    const fl = studentIds.map((sid) => ({ id: ++floatId.current, sid, text: `+${target.xp} XP`, color }));
    setFloats((f) => [...f, ...fl]);
    setTimeout(() => setFloats((f) => f.filter((x) => !fl.some((y) => y.id === x.id))), 1200);
    setSel(new Set());
    try {
      const r = await rpc<{ awarded: number; skipped: number; batch_id: string }>('award_points', {
        p_group_id: groupId, p_student_ids: studentIds,
        p_competency_id: isQa ? null : target.id, p_quick_action_id: isQa ? target.id : null, p_client_key: uuid(),
      });
      if (r.awarded === 0) {
        setData(prev);
        toast({ kind: 'info', text: 'Ja s’havia registrat fa un moment (antiduplicats).' });
      } else {
        setLastUndo(r.batch_id);
        toast({
          kind: 'ok',
          text: `${label}: +${target.xp} XP ${r.awarded === 1 ? 'a ' + (data.students.find((s) => s.id === studentIds[0])?.first_name ?? '') : `a ${r.awarded} alumnes`}`,
          action: { label: 'Desfer', run: () => undo() },
        });
        reload(true);
      }
    } catch (e) {
      setData(prev);
      toast({ kind: 'error', text: (e as Error).message });
    } finally {
      setPending(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, groupId, pending, compById]);

  async function undo() {
    if (!groupId) return;
    try {
      const r = await rpc<{ undone: number; label?: string }>('undo_last', { p_group_id: groupId });
      toast({ kind: r.undone ? 'ok' : 'info', text: r.undone ? `Desfet: ${r.label} (${r.undone})` : 'No hi ha res per desfer.' });
      setLastUndo(null);
      reload(true);
    } catch (e) { toast({ kind: 'error', text: (e as Error).message }); }
  }

  async function awardRule(key: string, label: string) {
    if (!sel.size || !groupId) return;
    setPending(true);
    try {
      const r = await rpc<{ awarded: number; xp: number }>('award_rule', { p_rule_key: key, p_student_ids: [...sel], p_group_id: groupId, p_client_key: uuid() });
      toast({ kind: 'ok', text: `${label}: +${r.xp} XP a ${r.awarded}`, action: { label: 'Desfer', run: () => undo() } });
      setSel(new Set()); setShowRules(false); reload(true);
    } catch (e) { toast({ kind: 'error', text: (e as Error).message }); } finally { setPending(false); }
  }

  function tapStudent(s: BoardStudent) {
    if (armed) return award([s.id], armed);
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(s.id)) n.delete(s.id); else n.add(s.id);
      return n;
    });
  }

  function tapTarget(t: Competency | QuickAction) {
    if (sel.size) return award([...sel], t);
    setArmed((a) => (a?.id === t.id ? null : t));
  }

  const canUndo = !!(lastUndo || data?.last_batch);
  const selCount = sel.size;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1"><GroupPicker groups={groups} groupId={groupId} select={select} /></div>
        <button className="btn-ghost" onClick={undo} disabled={!canUndo} title={data?.last_batch ? `Últim: ${data.last_batch.label}` : 'Res per desfer'}>
          ↶ Desfer{data?.last_batch ? <span className="hidden text-xs text-ice/50 sm:inline">· {data.last_batch.label}</span> : null}
        </button>
      </div>

      {loading && !data ? <Spinner /> : error ? <ErrorBox error={error} onRetry={() => reload()} /> : data && (
        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          {/* Graella d'alumnes */}
          <section className="pb-[300px] sm:pb-[250px] lg:pb-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl font-bold">{data.group.code} <span className="text-sm font-normal text-ice/50">{data.group.name}</span></h1>
              {!data.session?.confirmed_at && (
                <Link to="/profe/assistencia" className="chip bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30">✅ Passa llista</Link>
              )}
              <div className="flex-1" />
              <button className="btn-ghost py-2" onClick={() => setSel(new Set(present.map((s) => s.id)))}>👥 Tot el grup</button>
              {selCount > 0 && <button className="btn-ghost py-2" onClick={() => setSel(new Set())}>Cap</button>}
            </div>
            {armed && (
              <div className="mb-2 flex items-center gap-3 rounded-xl bg-violet/15 px-3 py-2 text-sm ring-1 ring-violet/40">
                <span className="text-xl">{armed.icon}</span>
                <span>Mode ràfega: cada alumne que toquis rep <strong>{'label' in armed ? armed.label : armed.name}</strong>.</span>
                <button className="btn-ghost ml-auto py-1" onClick={() => setArmed(null)}>Acaba</button>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
              {data.students.map((s) => {
                const on = sel.has(s.id);
                const absent = s.status === 'justificada' || s.status === 'injustificada';
                return (
                  <button key={s.id} onClick={() => tapStudent(s)} aria-pressed={on}
                    className={`relative flex flex-col items-center gap-1 rounded-2xl p-2.5 pt-3 text-center transition active:scale-95 ${
                      on ? 'bg-cian/20 ring-2 ring-cian shadow-glow' : 'bg-night-800/70 ring-1 ring-white/10 hover:bg-night-700'} ${absent ? 'opacity-40' : ''}`}>
                    <Avatar cfg={s.avatar} seed={s.id} size={64} ring={on ? '#22D3EE' : undefined} />
                    <span className="w-full truncate text-sm font-semibold">{s.name}</span>
                    <span className="flex items-center gap-1 text-[11px] text-ice/50">Nv {s.level}</span>
                    {s.today > 0 && <span className="absolute right-1.5 top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-mint px-1.5 text-xs font-bold text-night-900">{s.today}</span>}
                    {absent && <span className="absolute left-1.5 top-1.5 text-xs">🚫</span>}
                    {on && <span className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-cian text-sm font-bold text-night-900">✓</span>}
                    {floats.filter((f) => f.sid === s.id).map((f) => (
                      <span key={f.id} className="pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 animate-floatUp whitespace-nowrap font-display text-lg font-bold" style={{ color: f.color, textShadow: `0 0 12px ${f.color}` }}>{f.text}</span>
                    ))}
                  </button>
                );
              })}
            </div>
            {data.students.length === 0 && <p className="py-10 text-center text-ice/50">Aquest grup encara no té alumnes.</p>}
          </section>

          {/* Panell de competències */}
          <aside className="fixed inset-x-0 bottom-0 z-30 lg:sticky lg:inset-auto lg:top-20 lg:z-auto lg:self-start">
            <div className="glass-strong scrollbar-thin max-h-[48vh] overflow-y-auto rounded-b-none p-3 shadow-[0_-10px_40px_rgba(0,0,0,.5)] lg:max-h-none lg:rounded-2xl lg:shadow-none">
              <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-ice/50">
                {selCount ? <span className="text-cian">{selCount} seleccionat{selCount > 1 ? 's' : ''} → toca una competència</span> : 'Toca un alumne i després una competència'}
              </p>
              <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-9 lg:grid-cols-3 lg:gap-2">
                {comps.map((c) => {
                  const isArmed = armed?.id === c.id;
                  return (
                    <button key={c.id} onClick={() => tapTarget(c)} disabled={pending}
                      className={`flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[11px] font-bold lg:min-h-[76px] lg:text-xs transition active:scale-95 disabled:opacity-60 ${selCount ? 'hover:brightness-125' : 'opacity-90'}`}
                      style={{ background: `${c.color}${isArmed ? '55' : selCount ? '30' : '1c'}`, boxShadow: isArmed || selCount ? `inset 0 0 0 1.5px ${c.color}` : `inset 0 0 0 1px ${c.color}44` }}
                      title={`${c.description} (+${c.xp} XP)`}>
                      <span className="text-2xl leading-none">{c.icon}</span>
                      <span className="leading-tight">{c.name}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mb-2 mt-3 hidden px-1 text-xs font-semibold uppercase tracking-wider text-ice/50 lg:block">Accions ràpides</p>
              <div className="scrollbar-thin mt-2 flex gap-1.5 overflow-x-auto lg:mt-0 lg:grid lg:grid-cols-2">
                {qas.map((q) => {
                  const c = q.competency_id ? compById.get(q.competency_id) : undefined;
                  const isArmed = armed?.id === q.id;
                  return (
                    <button key={q.id} onClick={() => tapTarget(q)} disabled={pending}
                      className={`flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-2.5 text-left text-xs font-semibold transition active:scale-95 disabled:opacity-60 ${isArmed ? 'bg-violet/30 ring-1 ring-violet' : 'bg-white/5 hover:bg-white/10'}`}
                      style={{ borderLeft: `3px solid ${c?.color ?? '#22D3EE'}` }}>
                      <span className="text-base">{q.icon}</span><span className="leading-tight">{q.label}</span>
                    </button>
                  );
                })}
              </div>
              <button className="btn-ghost mt-3 w-full text-xs" onClick={() => setShowRules((v) => !v)} disabled={!selCount}>
                🏆 Altres reconeixements (presentació, torneig, final de curs…)
              </button>
              {showRules && selCount > 0 && (
                <div className="mt-2 grid gap-1.5">
                  {data.rules.map((r) => (
                    <button key={r.key} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm hover:bg-white/10" onClick={() => awardRule(r.key, r.label)} disabled={pending}>
                      <span>{r.label}</span><span className="font-display font-bold text-cian">+{r.xp}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
