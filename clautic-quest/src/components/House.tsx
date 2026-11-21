// Casa futurista isomètrica generada a partir de la seva configuració.
// Parcel·la de 4×4 unitats; ranures fixes per als objectes (editor senzill per posicions predefinides).
import { memo } from 'react';
import type { HouseCfg } from '@/lib/types';
import { IsoBox, IsoCylinder, IsoDome, IsoTile, P, TechTree, pts, shade } from './iso';

export const SLOTS: { key: string; label: string; icon: string }[] = [
  { key: 'model', label: 'Model', icon: '🏠' },
  { key: 'teulada', label: 'Teulada', icon: '☀️' },
  { key: 'facana', label: 'Façana', icon: '🧱' },
  { key: 'porta', label: 'Porta', icon: '🚪' },
  { key: 'llum', label: 'LED', icon: '💡' },
  { key: 'jardi', label: 'Jardí', icon: '🌳' },
  { key: 'robot', label: 'Robot', icon: '🤖' },
  { key: 'dron', label: 'Dron', icon: '🛸' },
  { key: 'holograma', label: 'Holograma', icon: '✨' },
  { key: 'energia', label: 'Energia', icon: '🔋' },
];

export const WALL_COLORS = ['#E8F1FF', '#DDE7F7', '#F5F3FF', '#ECFEFF', '#FEF2F2', '#F0FDF4', '#FFF7ED', '#CBD5E1', '#334155', '#1E293B'];
export const ACCENT_COLORS = ['#22D3EE', '#8B5CF6', '#E5213B', '#34D399', '#FBBF24', '#F472B6', '#60A5FA', '#FB923C'];

const LED: Record<string, string> = { led_cian: '#22D3EE', led_violeta: '#8B5CF6', led_vermell: '#E5213B', led_or: '#FBBF24', led_arcadia: 'url(#rainbow)' };

type Geo = { x: number; y: number; w: number; d: number; h: number; roofX: number; roofY: number; roofZ: number; roofW: number };
function geometry(model: string): Geo {
  if (model === 'torre') return { x: 1, y: 1, w: 2, d: 2, h: 2.6, roofX: 1.3, roofY: 1.3, roofZ: 2.6, roofW: 1.4 };
  if (model === 'cupula') return { x: 0.9, y: 0.9, w: 2.2, d: 2.2, h: 0.8, roofX: 1.5, roofY: 1.5, roofZ: 2.15, roofW: 1 };
  return { x: 1, y: 1, w: 2, d: 2, h: 1.7, roofX: 1, roofY: 1, roofZ: 1.7, roofW: 2 };
}

function Body({ cfg, g }: { cfg: HouseCfg; g: Geo }) {
  const wall = cfg.wall_color, acc = cfg.accent_color;
  const dark = parseInt(wall.slice(1, 3), 16) < 90;
  const trim = dark ? shade(wall, 0.25) : shade(wall, -0.35);
  const fac = cfg.slots.facana;
  const y1 = g.y + g.d, x1 = g.x + g.w;
  const winFill = fac === 'facana_vidre' ? 'rgba(125,211,252,.85)' : acc;

  if (cfg.model === 'torre') {
    return (
      <g>
        <IsoBox x={g.x} y={g.y} w={g.w} d={g.d} h={1.5} color={wall} />
        <IsoBox x={g.roofX} y={g.roofY} z={1.5} w={g.roofW} d={g.roofW} h={1.1} color={wall} />
        {/* barana terrassa */}
        <polyline points={pts([g.x, y1, 1.75], [x1, y1, 1.75], [x1, g.y, 1.75])} fill="none" stroke={acc} strokeWidth={1.5} opacity={0.9} />
        {[0.25, 0.75].map((u) => (
          <polygon key={u} points={pts([x1, g.y + g.d * u - 0.25, 0.6], [x1, g.y + g.d * u + 0.25, 0.6], [x1, g.y + g.d * u + 0.25, 1.15], [x1, g.y + g.d * u - 0.25, 1.15])} fill={winFill} opacity={0.9} />
        ))}
        <polygon points={pts([g.roofX + g.roofW, g.roofY + 0.3, 1.8], [g.roofX + g.roofW, g.roofY + g.roofW - 0.3, 1.8], [g.roofX + g.roofW, g.roofY + g.roofW - 0.3, 2.3], [g.roofX + g.roofW, g.roofY + 0.3, 2.3])} fill={winFill} opacity={0.95} />
        <polygon points={pts([g.roofX + 0.3, g.roofY + g.roofW, 1.8], [g.roofX + 0.8, g.roofY + g.roofW, 1.8], [g.roofX + 0.8, g.roofY + g.roofW, 2.3], [g.roofX + 0.3, g.roofY + g.roofW, 2.3])} fill={winFill} opacity={0.75} />
        <Facade fac={fac} g={{ ...g, h: 1.5 }} trim={trim} />
      </g>
    );
  }
  if (cfg.model === 'cupula') {
    return (
      <g>
        <IsoBox x={g.x} y={g.y} w={g.w} d={g.d} h={g.h} color={wall} />
        <polygon points={pts([x1, g.y + 0.4, 0.3], [x1, y1 - 0.4, 0.3], [x1, y1 - 0.4, 0.6], [x1, g.y + 0.4, 0.6])} fill={winFill} opacity={0.9} />
        <IsoDome cx={g.x + g.w / 2} cy={g.y + g.d / 2} z={g.h} r={1.05} color={acc} stroke={shade(acc, 0.5)} />
        <Facade fac={fac} g={g} trim={trim} />
      </g>
    );
  }
  return (
    <g>
      <IsoBox x={g.x} y={g.y} w={g.w} d={g.d} h={g.h} color={wall} />
      {/* finestres a la cara dreta */}
      {[0.28, 0.72].map((u) => (
        <g key={u}>
          <polygon points={pts([x1, g.y + g.d * u - 0.3, 0.75], [x1, g.y + g.d * u + 0.3, 0.75], [x1, g.y + g.d * u + 0.3, 1.35], [x1, g.y + g.d * u - 0.3, 1.35])} fill={winFill} opacity={0.92} />
          <polygon points={pts([x1, g.y + g.d * u - 0.3, 1.25], [x1, g.y + g.d * u + 0.3, 1.25], [x1, g.y + g.d * u + 0.3, 1.35], [x1, g.y + g.d * u - 0.3, 1.35])} fill="#fff" opacity={0.5} />
        </g>
      ))}
      {/* finestra alta cara esquerra */}
      <polygon points={pts([g.x + 0.25, y1, 1.0], [g.x + 0.75, y1, 1.0], [g.x + 0.75, y1, 1.4], [g.x + 0.25, y1, 1.4])} fill={winFill} opacity={0.8} />
      {/* ràfec del terrat */}
      <polyline points={pts([g.x, y1, g.h], [x1, y1, g.h], [x1, g.y, g.h])} fill="none" stroke={trim} strokeWidth={1.4} />
      <Facade fac={fac} g={g} trim={trim} />
    </g>
  );
}

function Facade({ fac, g, trim }: { fac?: string; g: Geo; trim: string }) {
  if (!fac) return null;
  const x1 = g.x + g.w, y1 = g.y + g.d;
  if (fac === 'facana_panells') {
    return (
      <g stroke={trim} strokeWidth={0.8} opacity={0.7}>
        {[0.33, 0.66].map((u) => <line key={'r' + u} x1={P(x1, g.y + g.d * u, 0)[0]} y1={P(x1, g.y + g.d * u, 0)[1]} x2={P(x1, g.y + g.d * u, g.h)[0]} y2={P(x1, g.y + g.d * u, g.h)[1]} />)}
        {[0.33, 0.66].map((u) => <line key={'l' + u} x1={P(g.x + g.w * u, y1, 0)[0]} y1={P(g.x + g.w * u, y1, 0)[1]} x2={P(g.x + g.w * u, y1, g.h)[0]} y2={P(g.x + g.w * u, y1, g.h)[1]} />)}
        <polyline points={pts([g.x, y1, g.h * 0.5], [x1, y1, g.h * 0.5], [x1, g.y, g.h * 0.5])} fill="none" />
      </g>
    );
  }
  if (fac === 'facana_vidre') {
    return <polygon points={pts([g.x + 0.1, y1, 0.15], [x1 - 0.1, y1, 0.15], [x1 - 0.1, y1, g.h - 0.15], [g.x + 0.1, y1, g.h - 0.15])} fill="rgba(125,211,252,.35)" stroke="rgba(255,255,255,.5)" strokeWidth={0.8} />;
  }
  if (fac === 'facana_circuit') {
    const c = '#34D399';
    return (
      <g stroke={c} strokeWidth={1} fill="none" opacity={0.85}>
        <polyline points={pts([x1, g.y + 0.2, 0.2], [x1, g.y + 0.6, 0.6], [x1, g.y + 1.4, 0.6], [x1, g.y + 1.7, 0.9])} />
        <polyline points={pts([g.x + 0.2, y1, 1.3], [g.x + 0.7, y1, 1.0], [g.x + 1.3, y1, 1.0])} />
        <circle cx={P(x1, g.y + 1.7, 0.9)[0]} cy={P(x1, g.y + 1.7, 0.9)[1]} r={1.6} fill={c} />
        <circle cx={P(g.x + 1.3, y1, 1.0)[0]} cy={P(g.x + 1.3, y1, 1.0)[1]} r={1.6} fill={c} />
      </g>
    );
  }
  return null;
}

function Door({ kind, g, acc }: { kind?: string; g: Geo; acc: string }) {
  const y1 = g.y + g.d, x0 = g.x + g.w * 0.45, x1 = x0 + 0.55;
  const h = 0.95;
  if (kind === 'porta_portal') {
    const [ax, ay] = P((x0 + x1) / 2, y1, h * 0.55);
    return (
      <g>
        <polygon points={pts([x0 - 0.05, y1, 0], [x1 + 0.05, y1, 0], [x1 + 0.05, y1, h + 0.1], [x0 - 0.05, y1, h + 0.1])} fill="#2E1065" />
        <ellipse cx={ax} cy={ay} rx={7} ry={11} fill="#8B5CF6" opacity={0.85} className="anim-pulse" />
        <ellipse cx={ax} cy={ay} rx={4} ry={7} fill="#C4B5FD" opacity={0.8} />
      </g>
    );
  }
  const sliding = kind === 'porta_lliscant';
  return (
    <g>
      <polygon points={pts([x0, y1, 0], [x1, y1, 0], [x1, y1, h], [x0, y1, h])} fill={sliding ? '#1E293B' : shade(acc, -0.3)} />
      {sliding && <line x1={P((x0 + x1) / 2, y1, 0)[0]} y1={P((x0 + x1) / 2, y1, 0)[1]} x2={P((x0 + x1) / 2, y1, h)[0]} y2={P((x0 + x1) / 2, y1, h)[1]} stroke="#22D3EE" strokeWidth={1.4} className="anim-pulse" />}
      <polyline points={pts([x0, y1, 0], [x0, y1, h], [x1, y1, h], [x1, y1, 0])} fill="none" stroke={acc} strokeWidth={1.3} />
    </g>
  );
}

function Leds({ kind, g }: { kind?: string; g: Geo }) {
  if (!kind) return null;
  const c = LED[kind] ?? '#22D3EE';
  const h = g.h;
  const x1 = g.x + g.w, y1 = g.y + g.d;
  const z = h - 0.05;
  return (
    <g filter="url(#glow)">
      <polyline points={pts([g.x, y1, z], [x1, y1, z], [x1, g.y, z])} fill="none" stroke={c} strokeWidth={2.2} strokeLinecap="round" className={kind === 'led_arcadia' ? 'anim-hue' : undefined} />
      <polyline points={pts([g.x, y1, 0.05], [x1, y1, 0.05], [x1, g.y, 0.05])} fill="none" stroke={c} strokeWidth={1.4} opacity={0.7} />
      <line x1={P(x1, y1, 0)[0]} y1={P(x1, y1, 0)[1]} x2={P(x1, y1, h)[0]} y2={P(x1, y1, h)[1]} stroke={c} strokeWidth={1.6} opacity={0.85} />
    </g>
  );
}

function Roof({ kind, g }: { kind?: string; g: Geo }) {
  if (!kind) return null;
  const cx = g.roofX + g.roofW / 2, cy = g.roofY + g.roofW / 2, z = g.roofZ;
  switch (kind) {
    case 'solar_basic':
    case 'solar_pro': {
      const pro = kind === 'solar_pro';
      const panels = pro ? [[-0.55, -0.55], [0.05, -0.55], [-0.55, 0.05], [0.05, 0.05]] : [[-0.45, -0.3], [0.05, -0.3]];
      return (
        <g>
          {panels.map(([dx, dy], i) => (
            <g key={i}>
              <polygon points={pts([cx + dx, cy + dy, z + 0.25], [cx + dx + 0.5, cy + dy, z + 0.25], [cx + dx + 0.5, cy + dy + 0.5, z + 0.05], [cx + dx, cy + dy + 0.5, z + 0.05])} fill={pro ? '#312E81' : '#1E3A8A'} stroke="#93C5FD" strokeWidth={0.7} />
              <line x1={P(cx + dx + 0.25, cy + dy, z + 0.25)[0]} y1={P(cx + dx + 0.25, cy + dy, z + 0.25)[1]} x2={P(cx + dx + 0.25, cy + dy + 0.5, z + 0.05)[0]} y2={P(cx + dx + 0.25, cy + dy + 0.5, z + 0.05)[1]} stroke="#93C5FD" strokeWidth={0.5} />
            </g>
          ))}
        </g>
      );
    }
    case 'antena':
    case 'antena_daurada': {
      const [bx, by] = P(cx, cy, z), [tx, ty] = P(cx, cy, z + 1.2);
      const col = kind === 'antena_daurada' ? '#FBBF24' : '#CBD5E1';
      return (
        <g>
          <line x1={bx} y1={by} x2={tx} y2={ty} stroke={col} strokeWidth={2} />
          <line x1={tx - 6} y1={ty + 8} x2={tx + 6} y2={ty + 8} stroke={col} strokeWidth={1.5} />
          <line x1={tx - 4} y1={ty + 14} x2={tx + 4} y2={ty + 14} stroke={col} strokeWidth={1.5} />
          <circle cx={tx} cy={ty} r={3} fill={kind === 'antena_daurada' ? '#FDE68A' : '#E5213B'} className="anim-pulse" />
          <circle cx={tx} cy={ty} r={7} fill="none" stroke={kind === 'antena_daurada' ? '#FDE68A' : '#E5213B'} strokeWidth={0.8} opacity={0.6} className="anim-pulse" />
        </g>
      );
    }
    case 'turbina': {
      const [bx, by] = P(cx, cy, z), [tx, ty] = P(cx, cy, z + 1.4);
      return (
        <g>
          <line x1={bx} y1={by} x2={tx} y2={ty} stroke="#E2E8F0" strokeWidth={2.2} />
          <g className="anim-spin" style={{ transformOrigin: `${tx}px ${ty}px` }}>
            {[0, 120, 240].map((a) => <path key={a} d={`M${tx},${ty} l-2,-15 l2,-3 l2,3 z`} fill="#F8FAFC" transform={`rotate(${a} ${tx} ${ty})`} />)}
          </g>
          <circle cx={tx} cy={ty} r={2.5} fill="#22D3EE" />
        </g>
      );
    }
    case 'parabolica': {
      const [bx, by] = P(cx, cy, z);
      return (
        <g>
          <line x1={bx} y1={by} x2={bx} y2={by - 10} stroke="#94A3B8" strokeWidth={2} />
          <ellipse cx={bx} cy={by - 16} rx={10} ry={6} fill="#E2E8F0" stroke="#64748B" transform={`rotate(-25 ${bx} ${by - 16})`} />
          <line x1={bx} y1={by - 16} x2={bx + 7} y2={by - 24} stroke="#64748B" strokeWidth={1} />
          <circle cx={bx + 7} cy={by - 24} r={1.8} fill="#E5213B" className="anim-pulse" />
        </g>
      );
    }
  }
  return null;
}

function Garden({ kind }: { kind?: string }) {
  if (!kind) return null;
  const x = 0.55, y = 3.35;
  switch (kind) {
    case 'arbre_tec': return <TechTree x={x} y={y} s={1} color="#34D399" />;
    case 'bonsai_led': return <TechTree x={x} y={y} s={0.65} color="#A3E635" />;
    case 'flors_holo': {
      const [bx, by] = P(x, y);
      return (
        <g className="anim-hue">
          {[[-6, 0], [0, -3], [6, 1], [-2, 4], [4, 5]].map(([dx, dy], i) => (
            <g key={i}>
              <line x1={bx + dx} y1={by + dy} x2={bx + dx} y2={by + dy - 9} stroke="#34D399" strokeWidth={1.2} />
              <circle cx={bx + dx} cy={by + dy - 11} r={3} fill={['#F472B6', '#22D3EE', '#FBBF24', '#A78BFA', '#F472B6'][i]} opacity={0.9} />
            </g>
          ))}
        </g>
      );
    }
    case 'font_mini': {
      const [bx, by] = P(x + 0.1, y);
      return (
        <g>
          <ellipse cx={bx} cy={by} rx={13} ry={6.5} fill="#94A3B8" />
          <ellipse cx={bx} cy={by - 1.5} rx={11} ry={5} fill="#22D3EE" opacity={0.85} />
          <path d={`M${bx},${by - 2} Q${bx - 5},${by - 18} ${bx - 9},${by - 3} M${bx},${by - 2} Q${bx + 5},${by - 18} ${bx + 9},${by - 3}`} stroke="#A5F3FC" strokeWidth={1.4} fill="none" className="anim-pulse" />
        </g>
      );
    }
  }
  return null;
}

function Robot({ kind }: { kind?: string }) {
  if (!kind) return null;
  const x = 3.5, y = 2.8;
  const [bx, by] = P(x, y);
  const gold = kind === 'robot_veterà';
  if (kind === 'robot_gos') {
    return (
      <g className="anim-hover">
        <IsoBox x={x - 0.3} y={y - 0.15} z={0.15} w={0.55} d={0.3} h={0.25} color="#E5213B" />
        <IsoBox x={x + 0.2} y={y - 0.1} z={0.35} w={0.22} d={0.22} h={0.22} color="#F1F5F9" />
        <circle cx={P(x + 0.42, y + 0.05, 0.48)[0]} cy={P(x + 0.42, y + 0.05, 0.48)[1]} r={1.3} fill="#22D3EE" />
        {[[-0.25, -0.1], [-0.25, 0.1], [0.15, -0.1], [0.15, 0.1]].map(([dx, dy], i) => (
          <line key={i} x1={P(x + dx, y + dy, 0.15)[0]} y1={P(x + dx, y + dy, 0.15)[1]} x2={P(x + dx, y + dy, 0)[0]} y2={P(x + dx, y + dy, 0)[1]} stroke="#475569" strokeWidth={1.5} />
        ))}
      </g>
    );
  }
  if (kind === 'robot_aranya') {
    return (
      <g>
        {[-1, 1].map((s) => [0, 1, 2].map((i) => (
          <path key={`${s}${i}`} d={`M${bx},${by - 8} q${s * 8},${-6 + i * 3} ${s * 13},${2 + i * 3}`} stroke="#6D28D9" strokeWidth={1.5} fill="none" />
        )))}
        <ellipse cx={bx} cy={by - 9} rx={8} ry={6} fill="#8B5CF6" />
        <circle cx={bx - 2.5} cy={by - 10} r={1.4} fill="#22D3EE" className="anim-pulse" />
        <circle cx={bx + 2.5} cy={by - 10} r={1.4} fill="#22D3EE" className="anim-pulse" />
      </g>
    );
  }
  // robot_huma i robot_veterà
  const body = gold ? '#FBBF24' : '#E8F1FF';
  return (
    <g>
      <ellipse cx={bx} cy={by} rx={6} ry={3} fill="rgba(0,0,0,.25)" />
      <rect x={bx - 4} y={by - 13} width={8} height={11} rx={2.5} fill={body} stroke={shade(body, -0.4)} strokeWidth={0.6} />
      <rect x={bx - 4.5} y={by - 21} width={9} height={7.5} rx={3} fill={body} stroke={shade(body, -0.4)} strokeWidth={0.6} />
      <rect x={bx - 3.2} y={by - 19} width={6.4} height={2.6} rx={1.3} fill="#0E1430" />
      <circle cx={bx - 1.4} cy={by - 17.7} r={0.9} fill="#22D3EE" className="anim-pulse" />
      <circle cx={bx + 1.4} cy={by - 17.7} r={0.9} fill="#22D3EE" className="anim-pulse" />
      <line x1={bx} y1={by - 21} x2={bx} y2={by - 25} stroke={shade(body, -0.4)} strokeWidth={0.8} />
      <circle cx={bx} cy={by - 25.5} r={1.4} fill="#E5213B" />
      <circle cx={bx} cy={by - 8} r={1.6} fill={gold ? '#B45309' : '#22D3EE'} />
    </g>
  );
}

function Drone({ kind, g }: { kind?: string; g: Geo }) {
  if (!kind) return null;
  const [bx, by] = P(3.4, 3.4, g.roofZ + 0.9);
  const col = kind === 'dron_llum' ? '#FBBF24' : kind === 'dron_carrega' ? '#FB923C' : '#22D3EE';
  return (
    <g className="anim-hover">
      <ellipse cx={bx} cy={by + 22} rx={6} ry={2.5} fill="rgba(0,0,0,.18)" />
      <line x1={bx - 9} y1={by - 2} x2={bx + 9} y2={by - 2} stroke="#475569" strokeWidth={1.6} />
      <ellipse cx={bx - 9} cy={by - 3.5} rx={4.5} ry={1.2} fill="#CBD5E1" opacity={0.8} />
      <ellipse cx={bx + 9} cy={by - 3.5} rx={4.5} ry={1.2} fill="#CBD5E1" opacity={0.8} />
      <rect x={bx - 4.5} y={by - 3} width={9} height={5} rx={2.5} fill="#1E293B" stroke={col} strokeWidth={1} />
      <circle cx={bx} cy={by - 0.5} r={1.3} fill={col} className="anim-pulse" />
      {kind === 'dron_llum' && <path d={`M${bx - 3},${by + 2} L${bx - 9},${by + 20} L${bx + 9},${by + 20} L${bx + 3},${by + 2} Z`} fill="#FDE68A" opacity={0.18} />}
      {kind === 'dron_carrega' && <rect x={bx - 3.5} y={by + 3} width={7} height={6} fill="#B45309" stroke="#78350F" strokeWidth={0.6} />}
    </g>
  );
}

function Hologram({ kind, g }: { kind?: string; g: Geo }) {
  if (!kind) return null;
  const cx = g.roofX + g.roofW / 2, cy = g.roofY + g.roofW / 2;
  const [bx, by] = P(cx, cy, g.roofZ + (g.roofZ > 2 ? 0.9 : 1.1));
  const [px, py] = P(cx, cy, g.roofZ);
  const beam = <path d={`M${px - 3},${py} L${bx - 10},${by + 6} L${bx + 10},${by + 6} L${px + 3},${py} Z`} fill="url(#holo-beam)" opacity={0.55} />;
  let inner = null;
  switch (kind) {
    case 'holo_logo':
      inner = (
        <g className="anim-spin" style={{ transformOrigin: `${bx}px ${by}px` }}>
          <path d={`M${bx + 7},${by - 5} A9,9 0 1 0 ${bx + 7},${by + 5}`} stroke="#FF5A6E" strokeWidth={3} fill="none" />
          <circle cx={bx} cy={by} r={2.4} fill="#22D3EE" />
        </g>
      );
      break;
    case 'holo_pixel':
      inner = (
        <g fill="#A3E635" opacity={0.95}>
          {[[-1, -3], [0, -3], [-2, -2], [-1, -2], [0, -2], [1, -2], [-1, -1], [0, -1], [-2, 0], [1, 0], [-1, 1], [0, 1]].map(([dx, dy], i) => <rect key={i} x={bx + dx * 3} y={by + dy * 3} width={3} height={3} />)}
        </g>
      );
      break;
    case 'holo_planeta':
      inner = (
        <g>
          <circle cx={bx} cy={by} r={7} fill="#60A5FA" opacity={0.85} />
          <ellipse cx={bx} cy={by} rx={13} ry={3.5} fill="none" stroke="#BFDBFE" strokeWidth={1.2} transform={`rotate(-15 ${bx} ${by})`} />
          <circle cx={bx - 2} cy={by - 2} r={2} fill="#DBEAFE" opacity={0.7} />
        </g>
      );
      break;
    case 'holo_cub':
      inner = (
        <g className="anim-hover">
          <IsoBox x={cx - 0.25} y={cy - 0.25} z={g.roofZ + 0.85} w={0.5} d={0.5} h={0.5} color="#34D399" opacity={0.75} stroke="#A7F3D0" />
        </g>
      );
      break;
    case 'holo_trofeu':
      inner = (
        <g>
          <path d={`M${bx - 6},${by - 8} h12 v4 a6,6 0 0 1 -12,0 z`} fill="#FBBF24" />
          <rect x={bx - 1.2} y={by + 2} width={2.4} height={4} fill="#F59E0B" />
          <rect x={bx - 4.5} y={by + 6} width={9} height={2.4} rx={1} fill="#F59E0B" />
        </g>
      );
      break;
    default: return null;
  }
  return <g>{beam}<g className="anim-hover">{inner}</g></g>;
}

function Energy({ kind }: { kind?: string }) {
  if (!kind) return null;
  const x = 3.35, y = 0.6;
  if (kind === 'bateria') {
    return (
      <g>
        <IsoBox x={x} y={y} w={0.4} d={0.4} h={0.55} color="#1E293B" />
        <polygon points={pts([x + 0.4, y + 0.08, 0.1], [x + 0.4, y + 0.32, 0.1], [x + 0.4, y + 0.32, 0.42], [x + 0.4, y + 0.08, 0.42])} fill="#34D399" className="anim-pulse" />
      </g>
    );
  }
  if (kind === 'generador') {
    return (
      <g>
        <IsoCylinder cx={x + 0.2} cy={y + 0.25} r={0.25} h={0.6} color="#475569" top="#FBBF24" />
        <circle cx={P(x + 0.2, y + 0.25, 0.6)[0]} cy={P(x + 0.2, y + 0.25, 0.6)[1]} r={3} fill="#FDE68A" className="anim-pulse" />
      </g>
    );
  }
  if (kind === 'nucli_mini') {
    const [bx, by] = P(x + 0.2, y + 0.2, 0.9);
    return (
      <g>
        <IsoCylinder cx={x + 0.2} cy={y + 0.2} r={0.28} h={0.25} color="#334155" />
        <g className="anim-hover">
          <path d={`M${bx},${by - 12} L${bx + 6},${by} L${bx},${by + 12} L${bx - 6},${by} Z`} fill="#E5213B" />
          <path d={`M${bx},${by - 12} L${bx + 6},${by} L${bx},${by + 2} Z`} fill="#FF8394" />
          <circle cx={bx} cy={by} r={11} fill="#E5213B" opacity={0.25} className="anim-pulse" />
        </g>
      </g>
    );
  }
  return null;
}

/** Dibuix complet de la parcel·la + casa. lod="mini" per a la vista general (molt més lleuger). */
export const HouseArt = memo(function HouseArt({ cfg, lod = 'full', accentGround }: { cfg: HouseCfg; lod?: 'full' | 'mini'; accentGround?: string }) {
  const g = geometry(cfg.model);
  if (lod === 'mini') {
    const h = cfg.model === 'torre' ? 2.4 : cfg.model === 'cupula' ? 0.8 : 1.6;
    const x1 = g.x + g.w, y1 = g.y + g.d;
    const led = LED[cfg.slots.llum ?? ''] ?? cfg.accent_color;
    return (
      <g>
        <IsoTile x={0.2} y={0.2} w={3.6} d={3.6} fill="#1F7A63" />
        <IsoBox x={g.x} y={g.y} w={g.w} d={g.d} h={h} color={cfg.wall_color} stroke="rgba(8,12,32,.35)" />
        {cfg.model === 'cupula'
          ? <IsoDome cx={2} cy={2} z={0.8} r={1} color={cfg.accent_color} stroke="none" />
          : <IsoTile x={g.x + 0.25} y={g.y + 0.25} w={g.w - 0.5} d={g.d - 0.5} z={h} fill={cfg.slots.teulada ? '#1E3A8A' : shade(cfg.accent_color, -0.2)} opacity={0.9} />}
        <polygon points={pts([x1, g.y + 0.35, h * 0.45], [x1, y1 - 0.35, h * 0.45], [x1, y1 - 0.35, h * 0.75], [x1, g.y + 0.35, h * 0.75])} fill={cfg.accent_color} opacity={0.95} />
        <polygon points={pts([g.x + 0.8, y1, 0], [g.x + 1.3, y1, 0], [g.x + 1.3, y1, 0.9], [g.x + 0.8, y1, 0.9])} fill={shade(cfg.accent_color, -0.35)} />
        <polyline points={pts([g.x, y1, h], [x1, y1, h], [x1, g.y, h])} fill="none" stroke={led} strokeWidth={2.4} />
        {cfg.slots.jardi && <circle cx={P(0.6, 3.3)[0]} cy={P(0.6, 3.3)[1] - 10} r={6} fill="#34D399" />}
        {cfg.slots.holograma && <circle cx={P(2, 2, h + 1)[0]} cy={P(2, 2, h + 1)[1]} r={4.5} fill="#22D3EE" opacity={0.85} />}
        {cfg.slots.robot && <rect x={P(3.5, 2.8)[0] - 3} y={P(3.5, 2.8)[1] - 11} width={6} height={10} rx={2} fill="#E8F1FF" />}
      </g>
    );
  }
  return (
    <g>
      {/* parcel·la */}
      <IsoBox x={0} y={0} z={-0.2} w={4} d={4} h={0.2} color="#2BAE8A" top="#1F8F70" stroke="rgba(8,12,32,.25)" />
      <IsoTile x={0.1} y={0.1} w={3.8} d={3.8} fill="#22A07D" />
      {accentGround && <polygon points={pts([0, 4, 0], [4, 4, 0], [4, 0, 0])} fill="none" stroke={accentGround} strokeWidth={1.6} opacity={0.9} filter="url(#glow)" />}
      <IsoTile x={g.x + g.w * 0.45} y={g.y + g.d} w={0.55} d={4 - g.y - g.d} fill="#CBD5E1" opacity={0.85} />
      {/* ombra de la casa */}
      <IsoTile x={g.x + 0.15} y={g.y + 0.15} w={g.w} d={g.d} fill="rgba(0,0,0,.18)" />
      <Body cfg={cfg} g={g} />
      <Door kind={cfg.slots.porta} g={g} acc={cfg.accent_color} />
      <Leds kind={cfg.slots.llum} g={cfg.model === 'torre' ? { ...g, h: 1.5 } : g} />
      <Roof kind={cfg.slots.teulada} g={g} />
      <Energy kind={cfg.slots.energia} />
      <Garden kind={cfg.slots.jardi} />
      <Robot kind={cfg.slots.robot} />
      <Drone kind={cfg.slots.dron} g={g} />
      <Hologram kind={cfg.slots.holograma} g={g} />
    </g>
  );
});

/** Definicions SVG compartides (filtres i degradats) — s'han d'incloure una vegada per SVG */
export function SvgDefs() {
  return (
    <defs>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <filter id="glow-big" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="6" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <linearGradient id="rainbow" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#E5213B" /><stop offset=".33" stopColor="#FBBF24" /><stop offset=".66" stopColor="#22D3EE" /><stop offset="1" stopColor="#8B5CF6" />
      </linearGradient>
      <linearGradient id="holo-beam" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stopColor="#22D3EE" stopOpacity=".9" /><stop offset="1" stopColor="#22D3EE" stopOpacity="0" />
      </linearGradient>
    </defs>
  );
}

/** Casa autònoma (SVG propi) per a targetes, editor i visites */
export function HouseView({ cfg, className = '', accentGround, tight }: { cfg: HouseCfg; className?: string; accentGround?: string; tight?: boolean }) {
  return (
    <svg viewBox={tight ? '-74 -48 148 130' : '-92 -58 184 152'} className={className} role="img" aria-label="Casa futurista">
      <SvgDefs />
      <HouseArt cfg={cfg} accentGround={accentGround} />
    </svg>
  );
}
