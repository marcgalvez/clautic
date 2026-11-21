import { useNavigate, useParams } from 'react-router-dom';
import { useRpc } from '@/lib/api';
import type { AvatarCfg, HouseCfg } from '@/lib/types';
import { Avatar } from '@/components/Avatar';
import { HouseView } from '@/components/House';
import { ErrorBox, Spinner } from '@/components/ui';

interface Visit { student_id: string; name: string; avatar: AvatarCfg; level: number; house: HouseCfg; district: { name: string; color: string } | null; badges: { icon: string; name: string; color: string }[]; is_mine: boolean }

export default function VisitHousePage({ light }: { light?: boolean }) {
  const { id } = useParams();
  const nav = useNavigate();
  const { data, error, loading, reload } = useRpc<Visit>('get_house', { p_student_id: id }, [id]);
  if (loading && !data) return <Spinner />;
  if (error || !data) return <ErrorBox error={error ?? 'Error'} onRetry={() => reload()} />;
  return (
    <div className="space-y-4">
      <button className={light ? 'rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold' : 'btn-ghost'} onClick={() => nav(-1)}>← Torna</button>
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#1f2a6b] via-[#151c45] to-[#0c1230] text-ice">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <Avatar cfg={data.avatar} seed={data.student_id} size={56} ring={data.district?.color} />
          <div>
            <h1 className="font-display text-2xl font-bold">Casa de {data.name}</h1>
            <p className="text-sm text-ice/60">Nivell {data.level}{data.district ? ` · ${data.district.name}` : ''}</p>
          </div>
          <div className="flex-1" />
          <span className="chip bg-white/10 text-ice/70">👀 Mode visita · només mirar</span>
        </div>
        <div className="mx-auto max-w-2xl px-4 pb-4">
          <HouseView cfg={data.house} className="w-full drop-shadow-[0_20px_40px_rgba(34,211,238,.25)]" />
        </div>
        {data.badges.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 border-t border-white/10 bg-night-950/40 p-3">
            {data.badges.map((b, i) => (
              <span key={i} title={b.name} className="flex h-10 w-10 items-center justify-center rounded-full text-xl" style={{ background: `${b.color}26`, boxShadow: `inset 0 0 0 2px ${b.color}` }}>{b.icon}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
