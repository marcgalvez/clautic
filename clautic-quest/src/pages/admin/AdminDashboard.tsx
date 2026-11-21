import { Link } from 'react-router-dom';
import { useRpc } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { LINES, type Line } from '@/lib/types';
import { Bars, Donut, HBars, Sparkline } from '@/components/charts';
import { Card, ErrorBox, PageHeader, Spinner, Stat } from '@/components/ui';

interface S {
  totals: { students: number; with_account: number; teachers: number; families: number; groups: number; xp_period: number; recognitions_period: number; coins_spent: number; badges_awarded: number; missions_completed: number };
  weekly: { week: string; xp: number; recognitions: number; attendance: number | null }[];
  attendance: { present: number; justificada: number; injustificada: number };
  competencies: { key: string; name: string; icon: string; color: string; count: number }[];
  low_recognized: { id: string; name: string; groups: string[] | null; count: number }[];
  groups: { id: string; code: string; line: Line; students: number; xp: number; recognitions: number; weeks: number[] }[];
  activities: { name: string; date: string; participa: number; collabora: number; destaca: number }[];
  missions: { title: string; icon: string; kind: string; count: number; goal: number }[];
}

export default function AdminDashboard() {
  const { data: s, error, loading, reload } = useRpc<S>('admin_stats', { p_days: 30 });
  if (loading && !s) return <Spinner />;
  if (error || !s) return <ErrorBox error={error ?? 'Error'} onRetry={() => reload()} />;
  const att = s.attendance, attTot = att.present + att.justificada + att.injustificada;
  const t = s.totals;
  return (
    <div className="space-y-5">
      <PageHeader title="Tauler de l’acadèmia" icon="📊" subtitle="Últims 30 dies. Dades per acompanyar, no per posar notes." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Alumnes actius" value={t.students} icon="🧑‍🎓" hint={`${t.with_account} amb compte activat`} />
        <Stat label="Grups actius" value={t.groups} icon="🧩" color="#8B5CF6" hint={`${t.teachers} professors`} />
        <Stat label="Reconeixements" value={t.recognitions_period} icon="⭐" color="#FBBF24" />
        <Stat label="XP atorgats" value={t.xp_period.toLocaleString('ca')} icon="⚡" color="#22D3EE" />
        <Stat label="Assistència" value={attTot ? `${Math.round((att.present / attTot) * 100)}%` : '—'} icon="✅" color="#34D399" />
        <Stat label="Missions" value={t.missions_completed} icon="🎯" color="#E5213B" hint={`${t.badges_awarded} insígnies`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Evolució setmanal de XP" className="lg:col-span-2">
          <Bars data={s.weekly.map((w) => ({ label: fmtDate(w.week), value: w.xp }))} height={170} />
        </Card>
        <Card title="Assistència">
          <div className="flex items-center gap-4">
            <Donut parts={[{ label: 'Present', value: att.present, color: '#34D399' }, { label: 'Justificada', value: att.justificada, color: '#FBBF24' }, { label: 'No justificada', value: att.injustificada, color: '#E5213B' }]} />
            <ul className="space-y-1 text-sm">
              <li><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-mint" />Presents: {att.present}</li>
              <li><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />Justificades: {att.justificada}</li>
              <li><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-brand" />No justificades: {att.injustificada}</li>
            </ul>
          </div>
          <div className="mt-3"><Bars data={s.weekly.map((w) => ({ label: fmtDate(w.week), value: w.attendance ?? 0, color: '#34D399' }))} height={70} format={(v) => `${v}%`} /></div>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Distribució de competències">
          <HBars data={s.competencies.map((c) => ({ label: c.name, value: c.count, color: c.color, icon: c.icon }))} />
        </Card>
        <Card title={`Alumnes poc reconeguts (${s.low_recognized.length})`} action={<span className="text-xs text-ice/50">≤ 2 en 30 dies</span>}>
          <ul className="scrollbar-thin max-h-72 space-y-1 overflow-y-auto text-sm">
            {s.low_recognized.map((l) => (
              <li key={l.id}><Link to={`/admin/alumne/${l.id}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-white/5">
                <span>{l.name} <span className="text-xs text-ice/40">{(l.groups ?? []).join(', ')}</span></span>
                <span className="chip bg-amber-400/15 text-amber-300">{l.count}</span>
              </Link></li>
            ))}
            {!s.low_recognized.length && <li className="text-mint">Tothom ha rebut reconeixements recentment 🎉</li>}
          </ul>
        </Card>
        <Card title="Evolució dels grups">
          <ul className="scrollbar-thin max-h-72 space-y-1 overflow-y-auto text-sm">
            {s.groups.map((g) => (
              <li key={g.id} className="flex items-center gap-3 rounded-lg px-2 py-1 hover:bg-white/5">
                <span className="w-10 font-display font-bold" style={{ color: LINES[g.line].color }}>{g.code}</span>
                <span className="w-16 text-xs text-ice/50">{g.students} alumnes</span>
                <Sparkline values={g.weeks} color={LINES[g.line].color} />
                <span className="ml-auto tabular-nums">{g.recognitions}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Participació en activitats">
          <table className="table-clean">
            <thead><tr><th>Activitat</th><th>Data</th><th>Participen</th><th>Col·laboren</th><th>Destaquen</th></tr></thead>
            <tbody>{s.activities.map((a) => <tr key={a.name}><td>{a.name}</td><td className="text-ice/60">{fmtDate(a.date)}</td><td>{a.participa}</td><td>{a.collabora}</td><td>{a.destaca}</td></tr>)}</tbody>
          </table>
        </Card>
        <Card title="Missions completades">
          <HBars data={s.missions.filter((m) => m.kind === 'individual').map((m) => ({ label: m.title, value: m.count, color: '#8B5CF6', icon: m.icon }))} />
        </Card>
      </div>
    </div>
  );
}
