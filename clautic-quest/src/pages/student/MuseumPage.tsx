import { useRpc } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { ErrorBox, Spinner } from '@/components/ui';

interface B { id: string; name: string; icon: string; color: string; description: string; category: string; rule_type: string | null; rule_value: number | null; awarded_at: string | null; holders: number }
const CATS: Record<string, string> = { antiguitat: '🗓️ Trajectòria', fita: '⚡ Fites', missio: '🎯 Missions', activitat: '🏆 Activitats', especial: '✨ Especials' };
const HINT: Record<string, (v: number) => string> = {
  anys: (v) => `${v} ${v === 1 ? 'any' : 'anys'} a ClauTIC`, nivell: (v) => `Arriba al nivell ${v}`, missions: (v) => `Completa ${v} missions`,
  activitats: (v) => `Participa en ${v} activitats`, reconeixements: (v) => `Rep ${v} reconeixements`,
};

export default function MuseumPage() {
  const { data, error, loading, reload } = useRpc<B[]>('museum');
  if (loading && !data) return <Spinner />;
  if (error || !data) return <ErrorBox error={error ?? 'Error'} onRetry={() => reload()} />;
  const got = data.filter((b) => b.awarded_at).length;
  return (
    <div className="space-y-5">
      <div className="glass relative overflow-hidden p-5">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-violet/30 blur-3xl" />
        <h1 className="font-display text-2xl font-bold">🏛️ Museu dels Assoliments</h1>
        <p className="text-sm text-ice/60">Les insígnies són per sempre. En tens <strong className="text-violet-soft">{got}</strong> de {data.length}.</p>
      </div>
      {Object.entries(CATS).map(([cat, title]) => {
        const list = data.filter((b) => b.category === cat);
        if (!list.length) return null;
        return (
          <section key={cat}>
            <h2 className="mb-2 font-display text-lg font-semibold">{title}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {list.map((b) => {
                const on = !!b.awarded_at;
                return (
                  <div key={b.id} className={`flex flex-col items-center rounded-2xl p-4 text-center transition ${on ? 'bg-night-800/80 ring-1' : 'bg-white/[.03] ring-1 ring-white/5'}`} style={on ? { boxShadow: `0 0 24px ${b.color}33`, ['--tw-ring-color' as string]: `${b.color}66` } : undefined}>
                    <span className={`flex h-16 w-16 items-center justify-center rounded-full text-4xl ${on ? 'animate-pop' : 'grayscale'}`}
                      style={{ background: on ? `radial-gradient(circle, ${b.color}55, ${b.color}11)` : 'rgba(255,255,255,.04)', boxShadow: on ? `inset 0 0 0 3px ${b.color}` : 'inset 0 0 0 2px rgba(255,255,255,.1)', opacity: on ? 1 : 0.45 }}>
                      {on ? b.icon : '🔒'}
                    </span>
                    <span className={`mt-2 text-sm font-semibold leading-tight ${on ? '' : 'text-ice/50'}`}>{b.name}</span>
                    <span className="mt-1 text-[11px] leading-tight text-ice/50">
                      {on ? `Aconseguida el ${fmtDate(b.awarded_at, true)}` : b.rule_type && b.rule_value ? HINT[b.rule_type]?.(b.rule_value) : b.description}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
