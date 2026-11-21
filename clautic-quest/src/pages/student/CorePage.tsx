import { useRpc } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { ErrorBox, Progress, Spinner } from '@/components/ui';
import type { CityData } from './CityPage';

export default function CorePage() {
  const { data, error, loading, reload } = useRpc<CityData>('city_overview');
  if (loading && !data) return <Spinner />;
  if (error || !data) return <ErrorBox error={error ?? 'Error'} onRetry={() => reload()} />;
  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand/40 via-violet/20 to-night-900 p-6">
        <div className="absolute right-6 top-4 h-24 w-24 rotate-45 rounded-xl bg-brand/60 blur-xl" />
        <h1 className="font-display text-3xl font-bold">⚡ Nucli d’energia ClauTIC</h1>
        <p className="mt-1 max-w-xl text-sm text-ice/75">El nucli s’alimenta de les missions que completem <strong>entre tots</strong>. Cada fita col·lectiva desbloqueja un element nou a la plaça central.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {data.community.map((c) => {
          const done = !!c.unlocked_at;
          return (
            <div key={c.id} className={`glass p-5 ${done ? 'ring-1 ring-mint/50' : ''}`}>
              <div className="text-5xl">{c.icon}</div>
              <h3 className="mt-2 font-display text-xl font-semibold">{c.title}</h3>
              <p className="mt-1 text-sm text-ice/60">{c.description}</p>
              <Progress pct={(c.progress / c.goal) * 100} color={done ? '#34D399' : '#8B5CF6'} className="mt-4 h-4" />
              <div className="mt-1 flex justify-between text-xs text-ice/60"><span>{Math.min(c.progress, c.goal)} / {c.goal}</span><span>{Math.min(100, Math.round((c.progress / c.goal) * 100))}%</span></div>
              <p className={`mt-3 text-sm font-semibold ${done ? 'text-mint' : 'text-violet-soft'}`}>
                {done ? `✓ ${c.unlock_name} desbloquejat el ${fmtDate(c.unlocked_at, true)}` : `🎁 Desbloqueja: ${c.unlock_name}`}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
