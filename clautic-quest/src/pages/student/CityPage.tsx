import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { useRpc } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { BUILDINGS, CityOverview, type BuildingKey, type CityDistrict } from '@/components/City';
import type { StudentOutlet } from '@/components/Shells';
import { ErrorBox, Progress, Spinner } from '@/components/ui';

export interface CityData {
  me: string | null;
  districts: CityDistrict[];
  plaza: { key: string; name: string; unlocked_at: string }[];
  community: { id: string; title: string; icon: string; description: string; goal: number; progress: number; unlock_name: string; unlocked_at: string | null }[];
}

export default function CityPage({ staff }: { staff?: boolean }) {
  const nav = useNavigate();
  const loc = useLocation();
  const base = loc.pathname.startsWith('/profe') ? '/profe' : '/ciutat';
  const outlet = useOutletContext<Partial<StudentOutlet>>();
  const dash = staff ? undefined : outlet?.dash;
  const { data, error, loading, reload } = useRpc<CityData>('city_overview');
  const [hover, setHover] = useState<BuildingKey | null>(null);
  const [zoom, setZoom] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 700 ? 2.2 : 1));
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
  }, [zoom, data]);

  if (loading && !data) return <Spinner label="Carregant la ciutat…" />;
  if (error || !data) return <ErrorBox error={error ?? 'Error'} onRetry={() => reload()} />;
  const nextGoal = data.community.find((c) => !c.unlocked_at);
  const total = data.districts.reduce((a, d) => a + d.houses.length, 0);

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#1a2257] via-[#141b45] to-[#0c1230]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(139,92,246,.35),transparent_60%)]" />
        <div className="absolute left-4 top-3 z-10">
          <h1 className="font-display text-xl font-bold md:text-2xl">ClauTIC City</h1>
          <p className="text-xs text-ice/60">{total} cases · {data.districts.length} barris</p>
        </div>
        {!staff && (
          <div className="absolute right-3 top-3 z-10 flex gap-2">
            <Link to="/ciutat/casa" className="btn-primary py-2">🏠 La meva casa</Link>
          </div>
        )}
        <div ref={scroller} className="scrollbar-thin relative h-[62vh] min-h-[380px] w-full overflow-auto md:h-[68vh]" onMouseLeave={() => setHover(null)}>
          <div style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}>
            <CityOverview districts={data.districts} plaza={data.plaza} highlightMe={!staff}
              onBuilding={staff ? undefined : (k) => nav(BUILDINGS[k].route)}
              onDistrict={(id) => nav(`${base}/barri/${id}`)} />
          </div>
        </div>
        <div className="absolute bottom-[72px] right-3 z-10 flex flex-col gap-1">
          <button className="h-10 w-10 rounded-xl bg-night-900/80 text-xl font-bold ring-1 ring-white/20 hover:bg-night-700" onClick={() => setZoom((z) => Math.min(3, z + 0.5))} aria-label="Apropa">+</button>
          <button className="h-10 w-10 rounded-xl bg-night-900/80 text-xl font-bold ring-1 ring-white/20 hover:bg-night-700" onClick={() => setZoom((z) => Math.max(1, z - 0.5))} aria-label="Allunya">−</button>
        </div>
        {!staff && (
          <div className="scrollbar-thin flex gap-2 overflow-x-auto border-t border-white/10 bg-night-950/40 p-2">
            {(Object.keys(BUILDINGS) as BuildingKey[]).filter((k) => k !== 'jardins').map((k) => (
              <button key={k} onClick={() => nav(BUILDINGS[k].route)} onMouseEnter={() => setHover(k)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${hover === k ? 'bg-white/15' : 'bg-white/5 hover:bg-white/10'}`}
                style={{ boxShadow: `inset 0 -2px 0 ${BUILDINGS[k].color}` }}>
                <span className="text-xl">{BUILDINGS[k].icon}</span>
                <span className="text-left leading-tight">{BUILDINGS[k].name}<span className="block text-[10px] font-normal text-ice/50">{BUILDINGS[k].desc}</span></span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {nextGoal && (
          <Link to={staff ? '#' : '/ciutat/nucli'} className="glass block min-w-0 p-4 transition hover:ring-1 hover:ring-violet/50">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-soft">⚡ Fita de tota la ciutat</div>
            <div className="mt-1 font-display text-lg font-semibold">{nextGoal.icon} {nextGoal.title}</div>
            <Progress pct={(nextGoal.progress / nextGoal.goal) * 100} color="#8B5CF6" className="mt-2 h-3" />
            <p className="mt-1 text-xs text-ice/60">{nextGoal.progress}/{nextGoal.goal} missions · desbloqueja: {nextGoal.unlock_name}</p>
          </Link>
        )}
        {dash && (
          <>
            <div className="glass min-w-0 p-4 md:col-span-2">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ice/50">Els teus últims reconeixements</div>
              <div className="scrollbar-thin flex gap-2 overflow-x-auto">
                {dash.recent.slice(0, 8).map((r) => (
                  <div key={r.id} className="flex w-28 shrink-0 flex-col items-center rounded-xl bg-white/5 p-2 text-center" style={{ boxShadow: `inset 0 -3px 0 ${r.competency?.color ?? '#22D3EE'}` }}>
                    <span className="text-3xl">{r.competency?.icon ?? (r.source === 'assistencia' ? '✅' : r.source === 'missio' ? '🎯' : '🏆')}</span>
                    <span className="mt-1 line-clamp-2 text-xs font-semibold leading-tight">{r.label}</span>
                    <span className="mt-0.5 text-[11px] text-cian">+{r.xp} XP</span>
                    <span className="text-[10px] text-ice/40">{timeAgo(r.created_at)}</span>
                  </div>
                ))}
                {!dash.recent.length && <p className="text-sm text-ice/50">Encara res. Segur que aviat arriben!</p>}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
