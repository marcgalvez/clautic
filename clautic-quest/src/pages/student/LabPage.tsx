import { useParams } from 'react-router-dom';
import { useRpc } from '@/lib/api';
import { LINES, type Line } from '@/lib/types';
import { Coin, ErrorBox, Spinner, XpIcon } from '@/components/ui';

export interface MissionS { id: string; title: string; description: string; kind: string; line: Line | null; icon: string; xp: number; coins: number; goal: number; progress: number; done: number; repeatable: boolean; unlock_name: string | null; unlocked_at: string | null; badge: { name: string; icon: string } | null }

export default function LabPage() {
  const { line } = useParams() as { line: Line };
  const L = LINES[line];
  const { data, error, loading, reload } = useRpc<MissionS[]>('student_missions');
  if (!L) return <ErrorBox error="Aquest edifici no existeix." />;
  if (loading && !data) return <Spinner />;
  if (error || !data) return <ErrorBox error={error ?? 'Error'} onRetry={() => reload()} />;
  const list = data.filter((m) => m.kind === 'individual' && (m.line === line || m.line === null));
  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-3xl p-6" style={{ background: `linear-gradient(135deg, ${L.color}55, #0E1430 70%)` }}>
        <div className="absolute -right-6 -top-6 text-[120px] opacity-20">{L.icon}</div>
        <p className="text-xs font-semibold uppercase tracking-[.3em] text-ice/60">Edifici</p>
        <h1 className="font-display text-3xl font-bold">{L.building}</h1>
        <p className="mt-1 max-w-lg text-sm text-ice/70">Completa aquests reptes a classe i demana al teu professor o professora que te’ls validi.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((m) => {
          const done = m.done > 0;
          return (
            <div key={m.id} className={`glass relative flex flex-col p-4 ${done ? 'ring-1 ring-mint/50' : ''}`}>
              {done && <span className="chip absolute right-3 top-3 bg-mint text-night-900">✓ {m.repeatable && m.done > 1 ? `×${m.done}` : 'Fet'}</span>}
              <span className="text-4xl">{m.icon}</span>
              <h3 className="mt-2 font-display text-lg font-semibold leading-tight">{m.title}</h3>
              <p className="mt-1 flex-1 text-sm text-ice/60">{m.description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm font-bold">
                <span className="flex items-center gap-1 text-cian"><XpIcon /> {m.xp}</span>
                <span className="flex items-center gap-1 text-amber-300"><Coin /> {m.coins}</span>
                {m.badge && <span className="chip bg-violet/20 text-violet-soft">{m.badge.icon} {m.badge.name}</span>}
                {m.line === null && <span className="chip bg-white/10 text-ice/60">General</span>}
                {m.repeatable && <span className="chip bg-white/10 text-ice/60">↻ Repetible</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
