// Eina d'equilibri: qui rep pocs reconeixements i quines competències queden poc treballades.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRpc } from '@/lib/api';
import { fmtDate, timeAgo } from '@/lib/format';
import type { AvatarCfg } from '@/lib/types';
import { GroupPicker, useTeacher } from '@/components/Shells';
import { Avatar } from '@/components/Avatar';
import { Bars, HBars } from '@/components/charts';
import { Card, ErrorBox, Spinner, Tabs } from '@/components/ui';

interface Stats {
  group: { code: string; name: string };
  students: { id: string; name: string; avatar: AvatarCfg; recognitions: number; xp: number; last: string | null; by_competency: Record<string, number>; attendance: { present: number; total: number } }[];
  competencies: { key: string; name: string; icon: string; color: string; count: number }[];
  weekly: { week: string; xp: number; count: number }[];
}

export default function BalancePage() {
  const { groups, groupId, select } = useTeacher();
  const [days, setDays] = useState<'7' | '30' | '90'>('30');
  const { data, error, loading, reload } = useRpc<Stats>(groupId ? 'group_stats' : null, { p_group_id: groupId, p_days: Number(days) }, [groupId, days]);

  const analysis = useMemo(() => {
    if (!data) return null;
    const st = [...data.students].sort((a, b) => a.recognitions - b.recognitions);
    const avg = st.reduce((a, s) => a + s.recognitions, 0) / Math.max(1, st.length);
    const low = st.filter((s) => s.recognitions <= Math.max(1, avg * 0.5));
    const comps = [...data.competencies].sort((a, b) => a.count - b.count);
    return { st, avg, low, lowComps: comps.slice(0, 3), max: Math.max(1, ...st.map((s) => s.recognitions)) };
  }, [data]);

  return (
    <div className="space-y-4">
      <GroupPicker groups={groups} groupId={groupId} select={select} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Equilibri de reconeixements</h1>
          <p className="text-sm text-ice/60">Per repartir el reconeixement de manera justa. No és una classificació ni una nota.</p>
        </div>
        <Tabs value={days} onChange={setDays} items={[{ value: '7', label: '7 dies' }, { value: '30', label: '30 dies' }, { value: '90', label: 'Trimestre' }]} />
      </div>
      {loading && !data ? <Spinner /> : error ? <ErrorBox error={error} onRetry={() => reload()} /> : data && analysis && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card title="💡 Suggeriments per a la propera sessió" className="md:col-span-2">
              {analysis.low.length > 0 ? (
                <>
                  <p className="text-sm text-ice/70">Aquests alumnes han rebut pocs reconeixements últimament. Fixa-t’hi especialment: segur que hi ha esforç per reconèixer.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {analysis.low.map((s) => (
                      <Link key={s.id} to={`/profe/alumne/${s.id}`} className="flex items-center gap-2 rounded-xl bg-amber-400/10 px-2.5 py-1.5 text-sm ring-1 ring-amber-400/30 hover:bg-amber-400/20">
                        <Avatar cfg={s.avatar} seed={s.id} size={28} /> {s.name} <span className="text-xs text-amber-300">{s.recognitions}</span>
                      </Link>
                    ))}
                  </div>
                </>
              ) : <p className="text-sm text-mint">Molt bé! El reconeixement està ben repartit en aquest grup.</p>}
              <p className="mt-4 text-sm text-ice/70">Competències menys treballades: {analysis.lowComps.map((c) => <span key={c.key} className="mr-2 whitespace-nowrap font-semibold" style={{ color: c.color }}>{c.icon} {c.name} ({c.count})</span>)}</p>
            </Card>
            <Card title="Reconeixements per setmana">
              <Bars data={data.weekly.map((w) => ({ label: fmtDate(w.week), value: w.count }))} color="#8B5CF6" height={130} />
            </Card>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Competències treballades">
              <HBars data={data.competencies.map((c) => ({ label: c.name, value: c.count, color: c.color, icon: c.icon }))} />
            </Card>
            <Card title="Alumnes (de menys a més reconeguts)" className="lg:col-span-2">
              <div className="overflow-x-auto">
                <table className="table-clean">
                  <thead><tr><th>Alumne</th><th>Reconeixements</th><th className="hidden md:table-cell">Competències</th><th>Últim</th><th>Assist.</th></tr></thead>
                  <tbody>
                    {analysis.st.map((s) => (
                      <tr key={s.id}>
                        <td><Link to={`/profe/alumne/${s.id}`} className="flex items-center gap-2 hover:text-cian"><Avatar cfg={s.avatar} seed={s.id} size={30} />{s.name}</Link></td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-24 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${(s.recognitions / analysis.max) * 100}%`, background: s.recognitions <= analysis.avg * 0.5 ? '#FBBF24' : '#22D3EE' }} /></div>
                            <span className="tabular-nums">{s.recognitions}</span>
                          </div>
                        </td>
                        <td className="hidden md:table-cell">
                          <div className="flex gap-0.5">
                            {data.competencies.map((c) => <span key={c.key} title={`${c.name}: ${s.by_competency[c.key] ?? 0}`} className="h-4 w-3 rounded-sm" style={{ background: c.color, opacity: s.by_competency[c.key] ? Math.min(1, 0.25 + s.by_competency[c.key] * 0.25) : 0.08 }} />)}
                          </div>
                        </td>
                        <td className="whitespace-nowrap text-xs text-ice/60">{s.last ? timeAgo(s.last) : 'mai'}</td>
                        <td className="text-xs text-ice/60">{s.attendance.total ? `${Math.round((s.attendance.present / s.attendance.total) * 100)}%` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
