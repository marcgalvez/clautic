import { useRpc } from '@/lib/api';
import { Spinner } from '@/components/ui';

interface C { id: string; key: string; name: string; icon: string; color: string; description: string; examples: string[]; family_explanation: string }

export default function FamilyCompetencies() {
  const { data, loading } = useRpc<C[]>('competencies_public');
  if (loading && !data) return <Spinner />;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Què reconeixem a ClauTIC?</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          A ClauTIC no només valorem el resultat final d’un robot o d’un videojoc. Reconeixem les actituds i competències que fan créixer
          els infants i joves com a persones i com a aprenents. Aquestes són les nou competències que observem a classe.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {(data ?? []).map((c) => (
          <article key={c.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" style={{ borderTop: `4px solid ${c.color}` }}>
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl" style={{ background: `${c.color}22` }}>{c.icon}</span>
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">{c.name}</h2>
                <p className="text-sm text-slate-500">{c.description}</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-700">{c.family_explanation}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Què observem a classe</p>
            <ul className="mt-1 list-inside list-disc text-sm text-slate-600">{c.examples.map((e) => <li key={e}>{e}</li>)}</ul>
          </article>
        ))}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
        <h2 className="font-display text-base font-bold text-slate-900">Sobre els punts</h2>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li><strong>XP (experiència)</strong>: mesura el progrés acumulat. No es gasta mai i es conserva entre cursos.</li>
          <li><strong>ClauCoins</strong>: moneda virtual per decorar la casa a ClauTIC City. No es pot comprar amb diners reals.</li>
          <li><strong>Insígnies</strong>: fites permanents (antiguitat, participació en activitats, missions…).</li>
          <li>Els punts <strong>no són notes acadèmiques</strong> i no es comparen els alumnes entre ells.</li>
        </ul>
      </div>
    </div>
  );
}
