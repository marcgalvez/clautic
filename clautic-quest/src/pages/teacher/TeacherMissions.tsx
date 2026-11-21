// Validació ràpida de missions: tria missió → toca alumnes → valida.
import { useMemo, useState } from 'react';
import { rpc, useRpc } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { LINES, type AvatarCfg, type Line } from '@/lib/types';
import { GroupPicker, useTeacher } from '@/components/Shells';
import { Avatar } from '@/components/Avatar';
import { Progress, Spinner } from '@/components/ui';

interface Mission { id: string; title: string; description: string; kind: 'individual' | 'comunitaria'; line: Line | null; icon: string; xp: number; coins: number; goal: number; progress: number; repeatable: boolean; unlock_name: string | null; unlocked_at: string | null }
interface Board { students: { id: string; name: string; avatar: AvatarCfg }[]; group: { line: Line } }

export default function TeacherMissions() {
  const { groups, groupId, select, group } = useTeacher();
  const toast = useToast();
  const missions = useRpc<Mission[]>('student_missions');
  const board = useRpc<Board>(groupId ? 'class_board' : null, { p_group_id: groupId }, [groupId]);
  const [mid, setMid] = useState<string | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const list = useMemo(() => {
    const all = missions.data ?? [];
    const line = group?.line;
    return {
      mine: all.filter((m) => m.kind === 'individual' && (m.line === null || m.line === line)),
      community: all.filter((m) => m.kind === 'comunitaria'),
    };
  }, [missions.data, group]);
  const m = (missions.data ?? []).find((x) => x.id === mid);

  async function validate() {
    if (!mid || !sel.size) return;
    setBusy(true);
    try {
      const r = await rpc<{ validated: number; unlocked: string[] }>('validate_mission', { p_mission_id: mid, p_student_ids: [...sel], p_group_id: groupId });
      toast({ kind: 'ok', text: `Missió validada per a ${r.validated} alumne${r.validated === 1 ? '' : 's'}${r.validated < sel.size ? ' (alguns ja la tenien)' : ''}` });
      (r.unlocked ?? []).forEach((u) => toast({ kind: 'info', text: `🎉 Fita col·lectiva! S’ha desbloquejat: ${u}` }));
      setSel(new Set());
      missions.reload(true);
    } catch (e) { toast({ kind: 'error', text: (e as Error).message }); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <GroupPicker groups={groups} groupId={groupId} select={select} />
      <h1 className="font-display text-2xl font-bold">Validar missions</h1>
      {missions.loading && !missions.data ? <Spinner /> : (
        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <div className="space-y-3">
            <div className="glass p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ice/50">1 · Tria la missió</p>
              <div className="space-y-1.5">
                {list.mine.map((x) => (
                  <button key={x.id} onClick={() => setMid(x.id)}
                    className={`flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition ${mid === x.id ? 'bg-cian/20 ring-1 ring-cian' : 'bg-white/5 hover:bg-white/10'}`}>
                    <span className="text-2xl">{x.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{x.title}</span>
                      <span className="text-xs text-ice/50">{x.line ? LINES[x.line].name : 'General'} · +{x.xp} XP{x.repeatable ? ' · repetible' : ''}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="glass p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ice/50">Fites col·lectives</p>
              {list.community.map((c) => (
                <div key={c.id} className="mb-3">
                  <div className="flex justify-between text-sm"><span>{c.icon} {c.title}</span><span className="text-ice/60">{Math.min(c.progress, c.goal)}/{c.goal}</span></div>
                  <Progress pct={(c.progress / c.goal) * 100} color={c.unlocked_at ? '#34D399' : '#8B5CF6'} />
                  {c.unlocked_at && <p className="mt-1 text-xs text-mint">✓ {c.unlock_name} desbloquejat</p>}
                </div>
              ))}
              <p className="text-xs text-ice/40">Cada missió validada fa avançar les fites de tota la ciutat.</p>
            </div>
          </div>
          <div className="glass p-3">
            <div className="mb-2 flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-ice/50">2 · Toca els alumnes que l’han completat</p>
              <div className="flex-1" />
              <button className="btn-ghost py-1.5 text-xs" onClick={() => setSel(new Set((board.data?.students ?? []).map((s) => s.id)))}>Tots</button>
              <button className="btn-ghost py-1.5 text-xs" onClick={() => setSel(new Set())}>Cap</button>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6">
              {(board.data?.students ?? []).map((s) => {
                const on = sel.has(s.id);
                return (
                  <button key={s.id} onClick={() => setSel((p) => { const n = new Set(p); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n; })}
                    className={`flex flex-col items-center gap-1 rounded-xl p-2 transition ${on ? 'bg-cian/20 ring-2 ring-cian' : 'bg-white/5 hover:bg-white/10'}`}>
                    <Avatar cfg={s.avatar} seed={s.id} size={52} />
                    <span className="w-full truncate text-center text-xs font-semibold">{s.name}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-end gap-3">
              {m && <span className="text-sm text-ice/60">{m.icon} {m.title} · +{m.xp} XP i +{m.coins} ClauCoins</span>}
              <button className="btn-primary px-6 py-3" disabled={!m || !sel.size || busy} onClick={validate}>3 · Valida ({sel.size})</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
