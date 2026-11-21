import { useRpc } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { ErrorBox, Spinner } from '@/components/ui';

interface A { id: string; name: string; kind: string; activity_date: string; description: string; location: string; xp_participa: number; xp_collabora: number; xp_destaca: number; participants: number; badge: { name: string; icon: string } | null; my_role: string | null }
const KIND: Record<string, string> = { torneig: '🏆 Torneig', competicio: '🥇 Competició', presentacio: '🎤 Presentació', jornada: '🎪 Jornada', comunitaria: '🤝 Comunitària', altres: '✨ Activitat' };
const ROLE: Record<string, string> = { participa: 'Hi has participat', collabora: 'Hi has col·laborat', destaca: 'Resultat destacat' };

export default function CompetitionsPage() {
  const { data, error, loading, reload } = useRpc<A[]>('public_activities');
  if (loading && !data) return <Spinner />;
  if (error || !data) return <ErrorBox error={error ?? 'Error'} onRetry={() => reload()} />;
  const now = new Date().toISOString().slice(0, 10);
  const up = data.filter((a) => a.activity_date >= now).reverse();
  const past = data.filter((a) => a.activity_date < now);
  const Card = (a: A) => (
    <div key={a.id} className={`glass flex flex-col p-4 ${a.my_role ? 'ring-1 ring-amber-400/50' : ''}`}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="chip bg-white/10">{KIND[a.kind] ?? a.kind}</span>
        <span className="text-ice/60">{fmtDate(a.activity_date, true)}</span>
      </div>
      <h3 className="mt-2 font-display text-lg font-semibold leading-tight">{a.name}</h3>
      <p className="mt-1 flex-1 text-sm text-ice/60">{a.description}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="chip bg-cian/15 text-cian">Participar: +{a.xp_participa} XP</span>
        {a.badge && <span className="chip bg-violet/20 text-violet-soft">{a.badge.icon} {a.badge.name}</span>}
        {a.my_role && <span className="chip bg-amber-400 text-night-900">⭐ {ROLE[a.my_role]}</span>}
      </div>
    </div>
  );
  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500/30 via-night-800 to-night-900 p-6">
        <div className="absolute -right-4 -top-6 text-[120px] opacity-20">🏆</div>
        <h1 className="font-display text-3xl font-bold">Centre de Competicions</h1>
        <p className="mt-1 max-w-lg text-sm text-ice/70">Tornejos, lligues i jornades especials. Participar sempre té premi, guanyis o no!</p>
      </div>
      {up.length > 0 && <section><h2 className="mb-2 font-display text-lg font-semibold">Properament</h2><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{up.map(Card)}</div></section>}
      <section><h2 className="mb-2 font-display text-lg font-semibold">Ja s’han fet</h2><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{past.map(Card)}</div></section>
    </div>
  );
}
