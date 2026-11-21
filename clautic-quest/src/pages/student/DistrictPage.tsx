import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useRpc } from '@/lib/api';
import { DistrictView } from '@/components/City';
import { ErrorBox, Spinner } from '@/components/ui';
import type { CityData } from './CityPage';

export default function DistrictPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const base = useLocation().pathname.startsWith('/profe') ? '/profe' : '/ciutat';
  const { data, error, loading, reload } = useRpc<CityData>('city_overview');
  if (loading && !data) return <Spinner />;
  if (error || !data) return <ErrorBox error={error ?? 'Error'} onRetry={() => reload()} />;
  const d = data.districts.find((x) => x.id === id);
  if (!d) return <ErrorBox error="Aquest barri no existeix." />;
  const idx = data.districts.indexOf(d);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-ghost" onClick={() => nav(base === '/profe' ? '/profe/ciutat' : '/ciutat')}>← Ciutat</button>
        <h1 className="font-display text-2xl font-bold" style={{ color: d.color }}>{d.name}</h1>
        <span className="text-sm text-ice/60">{d.houses.length} cases · toca una casa per visitar-la</span>
        <div className="flex-1" />
        <button className="btn-ghost" disabled={idx <= 0} onClick={() => nav(`${base}/barri/${data.districts[idx - 1].id}`)}>‹</button>
        <button className="btn-ghost" disabled={idx >= data.districts.length - 1} onClick={() => nav(`${base}/barri/${data.districts[idx + 1].id}`)}>›</button>
      </div>
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#1a2257] to-[#0c1230]">
        <div className="h-[72vh] min-h-[420px]">
          <DistrictView d={d} onHouse={(h) => nav(h.is_me ? '/ciutat/casa' : `${base}/casa/${h.student_id}`)} />
        </div>
      </div>
    </div>
  );
}
