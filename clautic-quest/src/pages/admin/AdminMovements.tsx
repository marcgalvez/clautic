import { useMemo, useState } from 'react';
import { rpc, useRpc } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { SOURCE_LABEL } from '@/lib/types';
import { Card, ErrorBox, PageHeader, Spinner, Tabs } from '@/components/ui';

interface M { id: string; student_id: string; student: string; teacher: string | null; group: string | null; source: string; label: string; xp: number; coins: number; note: string; created_at: string; undone_at: string | null }
interface A { id: number; actor: string | null; action: string; entity: string; entity_id: string; data: unknown; created_at: string }
const dt = new Intl.DateTimeFormat('ca-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function AdminMovements() {
  const toast = useToast();
  const [tab, setTab] = useState<'mov' | 'audit'>('mov');
  const mov = useRpc<M[]>('admin_movements', { p_limit: 500 });
  const audit = useRpc<A[]>(tab === 'audit' ? 'admin_audit' : null, { p_limit: 200 }, [tab]);
  const [q, setQ] = useState('');
  const [src, setSrc] = useState('');
  const list = useMemo(() => (mov.data ?? []).filter((m) => (!src || m.source === src) && (!q || `${m.student} ${m.teacher ?? ''} ${m.label}`.toLowerCase().includes(q.toLowerCase()))), [mov.data, q, src]);

  async function toggle(m: M) {
    try { await rpc('admin_toggle_movement', { p_id: m.id }); toast({ kind: 'ok', text: m.undone_at ? 'Moviment restaurat' : 'Moviment anul·lat' }); mov.reload(true); }
    catch (e) { toast({ kind: 'error', text: (e as Error).message }); }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Historial de moviments" icon="📜" subtitle="Tot queda registrat: qui, a qui, quan, per què i quants punts. Les anul·lacions també." />
      <Tabs value={tab} onChange={setTab} items={[{ value: 'mov', label: 'Moviments de punts' }, { value: 'audit', label: 'Auditoria' }]} />
      {tab === 'mov' ? (
        <Card>
          <div className="mb-3 flex flex-wrap gap-2">
            <input className="input max-w-xs" placeholder="Cerca alumne, professor o motiu…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="input w-auto" value={src} onChange={(e) => setSrc(e.target.value)}>
              <option value="">Tots els tipus</option>
              {Object.entries(SOURCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {mov.loading && !mov.data ? <Spinner /> : mov.error ? <ErrorBox error={mov.error} /> : (
            <div className="overflow-x-auto">
              <table className="table-clean">
                <thead><tr><th>Data</th><th>Alumne</th><th>Motiu</th><th className="hidden md:table-cell">Per</th><th>XP</th><th>Coins</th><th /></tr></thead>
                <tbody>
                  {list.map((m) => (
                    <tr key={m.id} className={m.undone_at ? 'opacity-40 line-through' : ''}>
                      <td className="whitespace-nowrap text-xs text-ice/60">{dt.format(new Date(m.created_at))}</td>
                      <td>{m.student}</td>
                      <td><span className="chip mr-1 bg-white/10 text-[10px]">{SOURCE_LABEL[m.source] ?? m.source}</span>{m.label}{m.note && <span className="block text-xs text-ice/50">{m.note}</span>}</td>
                      <td className="hidden text-xs text-ice/60 md:table-cell">{m.teacher ?? 'Sistema'}{m.group ? ` · ${m.group}` : ''}</td>
                      <td className={`tabular-nums ${m.xp < 0 ? 'text-brand-soft' : 'text-cian'}`}>{m.xp > 0 ? '+' : ''}{m.xp}</td>
                      <td className={`tabular-nums ${m.coins < 0 ? 'text-brand-soft' : 'text-amber-300'}`}>{m.coins > 0 ? '+' : ''}{m.coins}</td>
                      <td><button className="rounded-lg px-2 py-1 text-xs text-ice/60 hover:bg-white/10" onClick={() => toggle(m)}>{m.undone_at ? 'Restaura' : 'Anul·la'}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <Card>
          {audit.loading && !audit.data ? <Spinner /> : (
            <table className="table-clean">
              <thead><tr><th>Data</th><th>Qui</th><th>Acció</th><th>Element</th><th className="hidden md:table-cell">Detall</th></tr></thead>
              <tbody>
                {(audit.data ?? []).map((a) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap text-xs text-ice/60">{dt.format(new Date(a.created_at))}</td>
                    <td>{a.actor ?? 'Sistema'}</td><td><code className="text-cian">{a.action}</code></td><td className="text-xs">{a.entity}</td>
                    <td className="hidden max-w-md truncate text-xs text-ice/50 md:table-cell">{a.data ? JSON.stringify(a.data) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}
