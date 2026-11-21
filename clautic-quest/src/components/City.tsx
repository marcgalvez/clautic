// ClauTIC City: vista general isomètrica amb plaça, edificis funcionals i barris que creixen.
import { useMemo, type ReactNode } from 'react';
import type { HouseCfg } from '@/lib/types';
import { HouseArt, SvgDefs } from './House';
import { IsoBox, IsoCylinder, IsoDome, IsoLabel, IsoTile, P, TechTree, pts, shade, viewBoxFor } from './iso';

export interface CityHouse { student_id: string; name: string; plot: number; level: number; house: HouseCfg; is_me: boolean }
export interface CityDistrict { id: string; name: string; color: string; capacity: number; houses: CityHouse[] }

export type BuildingKey = 'robotica' | 'videojocs' | 'minecraft' | 'competicions' | 'museu' | 'botiga' | 'nucli' | 'jardins';
export const BUILDINGS: Record<BuildingKey, { name: string; route: string; icon: string; color: string; desc: string }> = {
  nucli: { name: 'Nucli d’energia', route: '/ciutat/nucli', icon: '⚡', color: '#E5213B', desc: 'Missions comunitàries' },
  robotica: { name: 'Lab. Robòtica', route: '/ciutat/lab/robotica', icon: '🤖', color: '#E5213B', desc: 'Missions de robòtica' },
  videojocs: { name: 'Estudi Videojocs', route: '/ciutat/lab/videojocs', icon: '🎮', color: '#8B5CF6', desc: 'Missions de videojocs' },
  minecraft: { name: 'Portal Minecraft', route: '/ciutat/lab/minecraft', icon: '⛏️', color: '#34D399', desc: 'Missions de Minecraft' },
  competicions: { name: 'Competicions', route: '/ciutat/competicions', icon: '🏆', color: '#FBBF24', desc: 'Activitats extraordinàries' },
  museu: { name: 'Museu', route: '/ciutat/museu', icon: '🏛️', color: '#A78BFA', desc: 'Insígnies i fites' },
  botiga: { name: 'Botiga', route: '/ciutat/botiga', icon: '🛍️', color: '#22D3EE', desc: 'Decoracions' },
  jardins: { name: 'Jardins', route: '/ciutat/nucli', icon: '🌳', color: '#34D399', desc: 'Espai comunitari' },
};

const BLOCK = 16, GAP = 2.5;
const DISTRICT_SLOTS: [number, number][] = [[1, 0], [0, 1], [1, 1], [-1, 0], [0, -1], [-1, 1], [1, -1], [-1, -1], [2, 0], [0, 2], [2, 1], [1, 2]];
const blockOrigin = (i: number): [number, number] => {
  const [bx, by] = DISTRICT_SLOTS[i] ?? [2 + Math.floor(i / 6), i % 6];
  return [bx * (BLOCK + GAP), by * (BLOCK + GAP)];
};

/** Posició d'una parcel·la dins del barri. scale = mida de la casa. */
export function plotPos(plot: number, ox: number, oy: number, cols = 6) {
  const col = plot % cols, row = Math.floor(plot / cols);
  return { x: ox + 0.5 + col * 2.55, y: oy + 1.2 + row * 3.6 };
}

function Hit({ onClick, label, children }: { onClick?: () => void; label: string; children: ReactNode }) {
  return (
    <g className={onClick ? 'iso-hit' : undefined} onClick={onClick} role={onClick ? 'button' : undefined} aria-label={label} tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => { if (onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(); } }}>
      <title>{label}</title>
      {children}
    </g>
  );
}

// ───────────── Edificis ─────────────
function Robotica({ x, y }: { x: number; y: number }) {
  const [ax, ay] = P(x + 4.3, y + 2.6, 0);
  return (
    <g>
      <IsoBox x={x} y={y} w={4} d={4} h={1.4} color="#E8F1FF" />
      <polyline points={pts([x, y + 4, 1.35], [x + 4, y + 4, 1.35], [x + 4, y, 1.35])} fill="none" stroke="#E5213B" strokeWidth={2.4} filter="url(#glow)" />
      {[0.8, 2.0, 3.2].map((u) => <polygon key={u} points={pts([x + 4, y + u - 0.35, 0.4], [x + 4, y + u + 0.35, 0.4], [x + 4, y + u + 0.35, 1.0], [x + 4, y + u - 0.35, 1.0])} fill="#22D3EE" opacity={0.85} />)}
      <polygon points={pts([x + 1.4, y + 4, 0], [x + 2.6, y + 4, 0], [x + 2.6, y + 4, 1.0], [x + 1.4, y + 4, 1.0])} fill="#1E293B" />
      <IsoDome cx={x + 2} cy={y + 2} z={1.4} r={1.5} color="#22D3EE" stroke="#A5F3FC" />
      {/* braç robòtic */}
      <g stroke="#F97316" strokeWidth={4} strokeLinecap="round" fill="none">
        <path d={`M${ax},${ay} L${ax + 4},${ay - 26} L${ax + 22},${ay - 34}`} />
      </g>
      <circle cx={ax + 4} cy={ay - 26} r={3.5} fill="#1E293B" />
      <path d={`M${ax + 22},${ay - 34} l6,-4 M${ax + 22},${ay - 34} l7,3`} stroke="#1E293B" strokeWidth={2.4} strokeLinecap="round" />
      <rect x={ax - 6} y={ay - 3} width={12} height={5} rx={2} fill="#334155" />
    </g>
  );
}

function Videojocs({ x, y }: { x: number; y: number }) {
  const px = [] as ReactNode[];
  const colors = ['#22D3EE', '#8B5CF6', '#E5213B', '#34D399', '#FBBF24', '#F472B6'];
  for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) {
    const u0 = x + 0.4 + i * 0.53, z0 = 0.7 + j * 0.42;
    px.push(<polygon key={`${i}-${j}`} points={pts([u0, y + 4, z0], [u0 + 0.47, y + 4, z0], [u0 + 0.47, y + 4, z0 + 0.36], [u0, y + 4, z0 + 0.36])}
      fill={colors[(i * 3 + j * 5) % 6]} opacity={0.9} className="anim-pulse" style={{ animationDelay: `${((i + j) % 5) * 0.4}s` }} />);
  }
  return (
    <g>
      <IsoBox x={x} y={y} w={4} d={4} h={2.6} color="#312E81" />
      <polygon points={pts([x + 0.3, y + 4, 0.6], [x + 3.7, y + 4, 0.6], [x + 3.7, y + 4, 2.4], [x + 0.3, y + 4, 2.4])} fill="#0B1024" stroke="#8B5CF6" strokeWidth={1.4} />
      {px}
      <polygon points={pts([x + 4, y + 0.5, 1.6], [x + 4, y + 3.5, 1.6], [x + 4, y + 3.5, 2.2], [x + 4, y + 0.5, 2.2])} fill="#8B5CF6" opacity={0.8} />
      <IsoBox x={x + 2.6} y={y + 0.6} z={2.6} w={0.8} d={0.8} h={0.5} color="#4C1D95" />
      <circle cx={P(x + 3, y + 1, 3.6)[0]} cy={P(x + 3, y + 1, 3.6)[1]} r={5} fill="#F472B6" className="anim-pulse" />
    </g>
  );
}

function Minecraft({ x, y }: { x: number; y: number }) {
  const blocks: ReactNode[] = [];
  const grass = '#4ADE80', dirt = '#92400E', obs = '#1E1B4B';
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) blocks.push(<IsoBox key={`g${i}${j}`} x={x + i} y={y + j} w={1} d={1} h={0.5} color={dirt} top={grass} stroke="rgba(0,0,0,.25)" />);
  const arch: [number, number][] = [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3], [2, 3], [3, 3], [3, 2], [3, 1], [3, 0]];
  return (
    <g>
      {blocks}
      {arch.filter(([, k]) => k < 3).map(([c, k]) => c === 0 && <IsoBox key={`a${c}${k}`} x={x + 0.5} y={y + 1.5} z={0.5 + k * 0.7} w={0.7} d={0.7} h={0.7} color={obs} />)}
      <polygon points={pts([x + 1.2, y + 1.85, 0.5], [x + 3.1, y + 1.85, 0.5], [x + 3.1, y + 1.85, 2.6], [x + 1.2, y + 1.85, 2.6])} fill="#8B5CF6" opacity={0.85} className="anim-pulse" />
      <polygon points={pts([x + 1.5, y + 1.86, 0.8], [x + 2.8, y + 1.86, 0.8], [x + 2.8, y + 1.86, 2.3], [x + 1.5, y + 1.86, 2.3])} fill="#C4B5FD" opacity={0.5} className="anim-pulse" style={{ animationDelay: '1s' }} />
      {[0, 1, 2].map((k) => <IsoBox key={`b${k}`} x={x + 3.1} y={y + 1.5} z={0.5 + k * 0.7} w={0.7} d={0.7} h={0.7} color={obs} />)}
      {[0, 1, 2, 3].map((k) => <IsoBox key={`t${k}`} x={x + 0.5 + k * 0.85} y={y + 1.5} z={2.6} w={0.85} d={0.7} h={0.6} color={obs} />)}
      <TechTree x={x + 0.6} y={y + 3.5} z={0.5} s={0.7} color="#22C55E" glow={false} />
    </g>
  );
}

function Competicions({ x, y }: { x: number; y: number }) {
  const cx = x + 2.3, cy = y + 2.3;
  return (
    <g>
      <IsoCylinder cx={cx} cy={cy} r={2.2} h={0.9} color="#475569" top="#334155" />
      <IsoCylinder cx={cx} cy={cy} r={1.6} h={0.92} color="#16A34A" top="#22C55E" />
      <ellipse cx={P(cx, cy, 0.93)[0]} cy={P(cx, cy, 0.93)[1]} rx={1.6 * 20 * Math.SQRT2 * 0.5} ry={1.6 * 20 * Math.SQRT2 * 0.25} fill="none" stroke="#fff" strokeWidth={1} opacity={0.6} />
      {[[x, y], [x + 4.6, y], [x, y + 4.6], [x + 4.6, y + 4.6]].map(([lx, ly], i) => {
        const [bx, by] = P(lx, ly, 0), [tx, ty] = P(lx, ly, 2.6);
        return (
          <g key={i}>
            <line x1={bx} y1={by} x2={tx} y2={ty} stroke="#CBD5E1" strokeWidth={2} />
            <rect x={tx - 6} y={ty - 4} width={12} height={5} rx={1.5} fill="#FEF9C3" filter="url(#glow)" />
          </g>
        );
      })}
      <g className="anim-hover">
        {(() => {
          const [bx, by] = P(cx, cy, 2.4);
          return (
            <g filter="url(#glow)">
              <path d={`M${bx - 9},${by - 12} h18 v6 a9,9 0 0 1 -18,0 z`} fill="#FBBF24" />
              <rect x={bx - 2} y={by + 3} width={4} height={6} fill="#F59E0B" />
              <rect x={bx - 7} y={by + 9} width={14} height={3.5} rx={1.5} fill="#F59E0B" />
            </g>
          );
        })()}
      </g>
    </g>
  );
}

function Museu({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <IsoBox x={x} y={y} z={0} w={4} d={3} h={0.3} color="#CBD5E1" />
      <IsoBox x={x + 0.3} y={y + 0.3} z={0.3} w={3.4} d={2.4} h={1.6} color="#F5F3FF" />
      {[0.5, 1.4, 2.3, 3.2].map((u) => <IsoBox key={'c' + u} x={x + u} y={y + 2.75} z={0.3} w={0.25} d={0.25} h={1.6} color="#E2E8F0" />)}
      {[0.6, 1.5, 2.4].map((u) => <IsoBox key={'r' + u} x={x + 3.75} y={y + u} z={0.3} w={0.25} d={0.25} h={1.6} color="#E2E8F0" />)}
      <IsoBox x={x - 0.1} y={y - 0.1} z={1.9} w={4.2} d={3.2} h={0.3} color="#A78BFA" />
      <g className="anim-hover">
        {(() => {
          const [bx, by] = P(x + 2, y + 1.5, 3.2);
          return (
            <g filter="url(#glow)">
              <polygon points={`${bx},${by - 11} ${bx + 9},${by - 5} ${bx + 9},${by + 5} ${bx},${by + 11} ${bx - 9},${by + 5} ${bx - 9},${by - 5}`} fill="#8B5CF6" opacity={0.9} />
              <text x={bx} y={by + 4} textAnchor="middle" fontSize={11}>★</text>
            </g>
          );
        })()}
      </g>
    </g>
  );
}

function Botiga({ x, y }: { x: number; y: number }) {
  const stripes = [0, 1, 2, 3, 4, 5].map((i) => (
    <polygon key={i} points={pts([x + i * 0.5, y + 3, 1.45], [x + i * 0.5 + 0.5, y + 3, 1.45], [x + i * 0.5 + 0.5, y + 3.6, 1.1], [x + i * 0.5, y + 3.6, 1.1])}
      fill={i % 2 ? '#F8FAFC' : '#22D3EE'} />
  ));
  const [sx, sy] = P(x + 1.5, y + 3, 2.1);
  return (
    <g>
      <IsoBox x={x} y={y} w={3} d={3} h={1.9} color="#ECFEFF" />
      <polygon points={pts([x + 0.3, y + 3, 0], [x + 2.7, y + 3, 0], [x + 2.7, y + 3, 1.05], [x + 0.3, y + 3, 1.05])} fill="#7DD3FC" opacity={0.8} />
      {stripes}
      <g transform={`translate(${sx} ${sy - 4}) skewY(26.5)`}>
        <rect x={-26} y={-8} width={52} height={14} rx={3} fill="#0E1430" stroke="#22D3EE" />
        <text x={0} y={3} textAnchor="middle" fontSize={9} fontFamily="Chakra Petch" fontWeight={700} fill="#22D3EE" filter="url(#glow)">BOTIGA</text>
      </g>
    </g>
  );
}

function Jardins({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <IsoTile x={x} y={y} w={3.4} d={3.4} fill="#15803D" />
      <IsoTile x={x + 0.2} y={y + 0.2} w={3} d={3} fill="#16A34A" />
      <IsoTile x={x + 1.4} y={y} w={0.6} d={3.4} fill="#A3A3A3" opacity={0.6} />
      <TechTree x={x + 0.7} y={y + 0.8} s={0.8} />
      <TechTree x={x + 2.8} y={y + 1.2} s={0.95} color="#2DD4BF" />
      <TechTree x={x + 0.8} y={y + 2.8} s={0.7} color="#A3E635" />
      <IsoBox x={x + 2.4} y={y + 2.5} w={0.8} d={0.3} h={0.25} color="#B45309" />
    </g>
  );
}

function Core({ x, y, power }: { x: number; y: number; power: number }) {
  const [bx, by] = P(x, y, 2.4 + power * 0.25);
  const r = 2.2 + power * 0.2;
  const rx = r * 20 * Math.SQRT2, ry = rx / 2;
  return (
    <g>
      <IsoCylinder cx={x} cy={y} r={2.6} h={0.35} color="#475569" top="#1E293B" />
      <ellipse cx={P(x, y, 0.36)[0]} cy={P(x, y, 0.36)[1]} rx={2.2 * 20 * Math.SQRT2} ry={1.1 * 20 * Math.SQRT2} fill="none" stroke="#22D3EE" strokeWidth={1.5} opacity={0.8} filter="url(#glow)" />
      <IsoCylinder cx={x} cy={y} r={0.6} h={1.2} color="#334155" top="#22D3EE" />
      <circle cx={bx} cy={by} r={40 + power * 6} fill="#E5213B" opacity={0.12} className="anim-pulse" />
      <g className="anim-hover">
        <ellipse cx={bx} cy={by + 6} rx={rx} ry={ry} fill="none" stroke="#22D3EE" strokeWidth={2} opacity={0.8} filter="url(#glow)" />
        <ellipse cx={bx} cy={by - 2} rx={rx * 0.75} ry={ry * 0.75} fill="none" stroke="#8B5CF6" strokeWidth={1.6} opacity={0.8} transform={`rotate(-12 ${bx} ${by - 2})`} />
        <g filter="url(#glow-big)">
          <path d={`M${bx},${by - 30} L${bx + 13},${by - 4} L${bx},${by + 20} L${bx - 13},${by - 4} Z`} fill="#E5213B" />
          <path d={`M${bx},${by - 30} L${bx + 13},${by - 4} L${bx},${by - 1} Z`} fill="#FF8394" />
          <path d={`M${bx},${by - 30} L${bx - 13},${by - 4} L${bx},${by - 1} Z`} fill="#FF5A6E" />
        </g>
      </g>
    </g>
  );
}

function Fountain({ x, y }: { x: number; y: number }) {
  const [bx, by] = P(x, y, 0.4);
  return (
    <g>
      <IsoCylinder cx={x} cy={y} r={1.1} h={0.35} color="#94A3B8" top="#22D3EE" />
      <g className="anim-pulse" filter="url(#glow)">
        <path d={`M${bx},${by} Q${bx - 14},${by - 40} ${bx - 26},${by}`} stroke="#A5F3FC" strokeWidth={2} fill="none" />
        <path d={`M${bx},${by} Q${bx + 14},${by - 40} ${bx + 26},${by}`} stroke="#A5F3FC" strokeWidth={2} fill="none" />
        <path d={`M${bx},${by} L${bx},${by - 34}`} stroke="#E0F2FE" strokeWidth={2.4} />
      </g>
    </g>
  );
}

function CrystalTree({ x, y }: { x: number; y: number }) {
  const [bx, by] = P(x, y, 0);
  return (
    <g filter="url(#glow)">
      <rect x={bx - 2} y={by - 26} width={4} height={26} fill="#C4B5FD" />
      {[[-12, -30, 10], [10, -34, 9], [0, -44, 12], [-6, -50, 7], [8, -52, 7]].map(([dx, dy, s], i) => (
        <path key={i} d={`M${bx + dx},${by + dy - s} l${s * 0.6},${s} l${-s * 0.6},${s} l${-s * 0.6},${-s} z`} fill={i % 2 ? '#22D3EE' : '#A78BFA'} opacity={0.9} className="anim-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
      ))}
    </g>
  );
}

function Satellite({ x, y }: { x: number; y: number }) {
  const [bx, by] = P(x, y, 7.5);
  return (
    <g className="anim-hover">
      <rect x={bx - 26} y={by - 4} width={18} height={8} fill="#1E3A8A" stroke="#93C5FD" />
      <rect x={bx + 8} y={by - 4} width={18} height={8} fill="#1E3A8A" stroke="#93C5FD" />
      <rect x={bx - 7} y={by - 7} width={14} height={14} rx={3} fill="#E2E8F0" />
      <circle cx={bx} cy={by} r={3} fill="#E5213B" className="anim-pulse" />
    </g>
  );
}

// ───────────── Vista general ─────────────
export function CityOverview({ districts, plaza = [], onBuilding, onDistrict, highlightMe = true }: {
  districts: CityDistrict[]; plaza?: { key: string }[]; onBuilding?: (k: BuildingKey) => void; onDistrict?: (id: string) => void; highlightMe?: boolean;
}) {
  const unlocked = new Set(plaza.map((p) => p.key));
  const blocks = useMemo(() => districts.map((d, i) => ({ d, o: blockOrigin(i) })).sort((a, b) => a.o[0] + a.o[1] - (b.o[0] + b.o[1])), [districts]);
  const vb = useMemo(() => {
    const corners: [number, number, number][] = [[0, 0, 6], [BLOCK, 0, 0], [0, BLOCK, 0], [BLOCK, BLOCK, 0]];
    blocks.forEach(({ o: [ox, oy] }) => corners.push([ox, oy, 3], [ox + BLOCK, oy, 0], [ox, oy + BLOCK, 0], [ox + BLOCK, oy + BLOCK, 0]));
    return viewBoxFor(corners, 40);
  }, [blocks]);
  const behind = blocks.filter((b) => b.o[0] + b.o[1] < 0);
  const front = blocks.filter((b) => b.o[0] + b.o[1] >= 0);
  const b = (k: BuildingKey, node: ReactNode) => <Hit key={k} label={`${BUILDINGS[k].name}: ${BUILDINGS[k].desc}`} onClick={onBuilding ? () => onBuilding(k) : undefined}>{node}</Hit>;

  return (
    <svg viewBox={vb} className="h-full w-full select-none" role="img" aria-label="ClauTIC City">
      <SvgDefs />
      {behind.map(({ d, o }) => <DistrictBlock key={d.id} d={d} ox={o[0]} oy={o[1]} onClick={onDistrict} highlightMe={highlightMe} />)}
      {/* Plaça */}
      <g>
        <IsoBox x={-0.6} y={-0.6} z={-0.4} w={BLOCK + 1.2} d={BLOCK + 1.2} h={0.4} color="#1B2350" top="#26306A" stroke="rgba(34,211,238,.25)" />
        <IsoTile x={0} y={0} w={BLOCK} d={BLOCK} fill="#2B3678" />
        <IsoTile x={7.2} y={0} w={1.6} d={BLOCK} fill="#3A4690" />
        <IsoTile x={0} y={7.2} w={BLOCK} d={1.6} fill="#3A4690" />
        <ellipse cx={P(8, 8)[0]} cy={P(8, 8)[1]} rx={4.2 * 20 * Math.SQRT2} ry={2.1 * 20 * Math.SQRT2} fill="#334190" stroke="#22D3EE" strokeOpacity={0.35} />
        <polyline points={pts([0, BLOCK, 0], [BLOCK, BLOCK, 0], [BLOCK, 0, 0])} fill="none" stroke="#22D3EE" strokeWidth={1.5} opacity={0.6} filter="url(#glow)" />
      </g>
      {b('robotica', <Robotica x={0.8} y={0.8} />)}
      {b('museu', <Museu x={6} y={0.4} />)}
      {b('videojocs', <Videojocs x={11.2} y={0.8} />)}
      {b('jardins', <Jardins x={0.6} y={6.3} />)}
      {unlocked.has('arbre_cristall') && <CrystalTree x={4.6} y={10.4} />}
      {b('nucli', <Core x={8} y={8} power={unlocked.size} />)}
      {b('botiga', <Botiga x={12.4} y={6.4} />)}
      {unlocked.has('font_holografica') && <Fountain x={10.4} y={10.4} />}
      {b('minecraft', <Minecraft x={0.8} y={11.2} />)}
      {b('competicions', <Competicions x={10.8} y={10.8} />)}
      {unlocked.has('satellit') && <Satellite x={8} y={8} />}
      <IsoLabel x={1.6} y={1.6} z={5.2} text="Robòtica" color="#E5213B" />
      <IsoLabel x={8} y={1.9} z={4.1} text="Museu" color="#A78BFA" />
      <IsoLabel x={13.2} y={2.8} z={4.6} text="Videojocs" color="#8B5CF6" />
      <IsoLabel x={2.4} y={8} z={2.6} text="Jardins" color="#34D399" />
      <IsoLabel x={8} y={8} z={6.2} text="Nucli ClauTIC" color="#E5213B" />
      <IsoLabel x={13.9} y={7.9} z={3.6} text="Botiga" color="#22D3EE" />
      <IsoLabel x={2.8} y={13.2} z={4.3} text="Minecraft" color="#34D399" />
      <IsoLabel x={13.1} y={13.1} z={3.9} text="Competicions" color="#FBBF24" />
      {front.map(({ d, o }) => <DistrictBlock key={d.id} d={d} ox={o[0]} oy={o[1]} onClick={onDistrict} highlightMe={highlightMe} />)}
    </svg>
  );
}

function DistrictBlock({ d, ox, oy, onClick, highlightMe }: { d: CityDistrict; ox: number; oy: number; onClick?: (id: string) => void; highlightMe: boolean }) {
  const houses = [...d.houses].sort((a, b) => {
    const pa = plotPos(a.plot, 0, 0), pb = plotPos(b.plot, 0, 0);
    return pa.x + pa.y - (pb.x + pb.y);
  });
  const me = d.houses.find((h) => h.is_me);
  return (
    <Hit label={`${d.name}: ${d.houses.length} cases`} onClick={onClick ? () => onClick(d.id) : undefined}>
      <IsoBox x={ox - 0.4} y={oy - 0.4} z={-0.4} w={BLOCK + 0.8} d={BLOCK + 0.8} h={0.4} color="#151C40" top="#1A2250" stroke="rgba(255,255,255,.06)" />
      <IsoTile x={ox} y={oy} w={BLOCK} d={BLOCK} fill="#1A6B57" opacity={0.55} />
      <polyline points={pts([ox, oy + BLOCK, 0], [ox + BLOCK, oy + BLOCK, 0], [ox + BLOCK, oy, 0])} fill="none" stroke={d.color} strokeWidth={1.6} opacity={0.75} filter="url(#glow)" />
      {[0, 1, 2, 3].map((r) => <IsoTile key={r} x={ox} y={oy + 0.55 + r * 3.6 + 3.05} w={BLOCK} d={0.5} fill="#334155" opacity={0.5} />)}
      {Array.from({ length: d.capacity }, (_, i) => i).filter((i) => !d.houses.some((h) => h.plot === i)).map((i) => {
        const p = plotPos(i, ox, oy);
        return <IsoTile key={`e${i}`} x={p.x + 0.12} y={p.y + 0.12} w={2.1} d={2.1} fill="none" stroke="#34D39955" strokeDasharray="3 3" />;
      })}
      {houses.map((h) => {
        const p = plotPos(h.plot, ox, oy);
        const [sx, sy] = P(p.x, p.y);
        return (
          <g key={h.student_id} transform={`translate(${sx} ${sy}) scale(.58)`}>
            <HouseArt cfg={h.house} lod="mini" />
          </g>
        );
      })}
      {highlightMe && me && (() => {
        const p = plotPos(me.plot, ox, oy);
        const [sx, sy] = P(p.x + 1.15, p.y + 1.15, 2.4);
        return (
          <g pointerEvents="none" className="anim-hover">
            <path d={`M${sx},${sy} l-7,-12 h14 z`} fill="#E5213B" stroke="#fff" strokeWidth={1.2} filter="url(#glow)" />
            <circle cx={sx} cy={sy - 18} r={8} fill="#E5213B" stroke="#fff" strokeWidth={1.2} />
            <text x={sx} y={sy - 15} textAnchor="middle" fontSize={9}>🏠</text>
          </g>
        );
      })()}
      <IsoLabel x={ox + BLOCK / 2} y={oy + BLOCK / 2} z={4} text={`${d.name} · ${d.houses.length}`} color={d.color} />
    </Hit>
  );
}

// ───────────── Barri ampliat ─────────────
export function DistrictView({ d, onHouse }: { d: CityDistrict; onHouse?: (h: CityHouse) => void }) {
  const COLS = 4, SP = 5.2;
  const rows = Math.max(1, Math.ceil(d.capacity / COLS));
  const W = COLS * SP + 1, D = rows * SP + 1;
  const byPlot = new Map(d.houses.map((h) => [h.plot, h]));
  const cells = Array.from({ length: d.capacity }, (_, i) => i).sort((a, b) => (a % COLS) + Math.floor(a / COLS) - ((b % COLS) + Math.floor(b / COLS)));
  const vb = viewBoxFor([[0, 0, 5], [W, 0, 0], [0, D, 0], [W, D, 0]], 30);
  return (
    <svg viewBox={vb} className="h-full w-full select-none" role="img" aria-label={d.name}>
      <SvgDefs />
      <IsoBox x={-0.3} y={-0.3} z={-0.4} w={W + 0.6} d={D + 0.6} h={0.4} color="#151C40" top="#1E2756" />
      {Array.from({ length: rows }, (_, r) => <IsoTile key={r} x={0} y={0.5 + r * SP + 4.2} w={W} d={0.6} fill="#334155" opacity={0.7} />)}
      <polyline points={pts([0, D, 0], [W, D, 0], [W, 0, 0])} fill="none" stroke={d.color} strokeWidth={2} filter="url(#glow)" />
      {cells.map((i) => {
        const h = byPlot.get(i);
        const x = 0.5 + (i % COLS) * SP, y = 0.4 + Math.floor(i / COLS) * SP;
        const [sx, sy] = P(x, y);
        if (!h) {
          return (
            <g key={i} transform={`translate(${sx} ${sy})`} opacity={0.5}>
              <IsoTile x={0.3} y={0.3} w={3.4} d={3.4} fill="none" stroke="#475569" strokeDasharray="4 3" />
            </g>
          );
        }
        return (
          <g key={i}>
            <Hit label={`Casa de ${h.name} (nivell ${h.level})`} onClick={onHouse ? () => onHouse(h) : undefined}>
              <g transform={`translate(${sx} ${sy})`}>
                <HouseArt cfg={h.house} accentGround={h.is_me ? '#E5213B' : undefined} />
              </g>
            </Hit>
            <IsoLabel x={x + 2} y={y + 2} z={h.house.model === 'torre' ? 4.4 : 3.6} text={`${h.is_me ? '🏠 ' : ''}${h.name} · Nv ${h.level}`} color={h.is_me ? '#E5213B' : d.color} small />
          </g>
        );
      })}
    </svg>
  );
}

export const shadeColor = shade;
