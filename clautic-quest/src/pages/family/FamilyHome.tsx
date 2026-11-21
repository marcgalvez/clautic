import { useEffect, useState } from 'react';
import { useSession } from '@/lib/session';
import { Avatar } from '@/components/Avatar';
import { StudentReport } from '@/components/StudentReport';

export default function FamilyHome() {
  const { ctx } = useSession();
  const kids = ctx?.children ?? [];
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => { if (!sel && kids.length) setSel(kids[0].id); }, [kids, sel]);

  if (!kids.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="text-4xl">👨‍👩‍👧</div>
        <h1 className="mt-2 text-xl font-bold">Encara no hi ha cap alumne vinculat</h1>
        <p className="mt-1 text-sm text-slate-500">Contacta amb l’acadèmia perquè vinculin el compte amb el vostre fill o filla.</p>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Hola, {ctx?.full_name?.split(' ')[0]} 👋</h1>
        <p className="text-sm text-slate-500">Aquí podeu seguir el progrés i els reconeixements a ClauTIC.</p>
      </div>
      {kids.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist">
          {kids.map((k) => (
            <button key={k.id} role="tab" aria-selected={sel === k.id} onClick={() => setSel(k.id)}
              className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold transition ${sel === k.id ? 'border-violet-400 bg-violet-50 text-violet-800 shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
              <Avatar cfg={k.avatar} seed={k.id} size={32} /> {k.first_name}
            </button>
          ))}
        </div>
      )}
      {sel && <StudentReport key={sel} studentId={sel} light houseLink={`/familia/casa/${sel}`} />}
      <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900">
        <strong>Com funciona?</strong> Els professors reconeixen actituds com l’esforç, la cooperació o la perseverança. Cada reconeixement dona
        experiència (XP) i monedes virtuals (ClauCoins) que el vostre fill pot fer servir per decorar la seva casa a ClauTIC City. No hi ha rànquings:
        cadascú progressa al seu ritme.
      </div>
    </div>
  );
}
