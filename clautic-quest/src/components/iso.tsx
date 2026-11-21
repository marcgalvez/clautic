// Primitives isomètriques 2:1 reutilitzables per a ClauTIC City (SVG pur)
import type { ReactNode, SVGProps } from 'react';

export const S = 20; // píxels per unitat de món
export type V3 = [number, number, number?];
export const P = (x: number, y: number, z = 0): [number, number] => [(x - y) * S, ((x + y) / 2 - z) * S];
export const pts = (...ps: V3[]) => ps.map(([x, y, z]) => P(x, y, z ?? 0).map((n) => n.toFixed(1)).join(',')).join(' ');

export function shade(hex: string, amt: number) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function IsoBox({ x, y, z = 0, w, d, h, color, top, left, right, stroke = 'rgba(8,12,32,.35)', opacity, children, ...rest }: {
  x: number; y: number; z?: number; w: number; d: number; h: number; color: string;
  top?: string; left?: string; right?: string; stroke?: string; opacity?: number; children?: ReactNode;
} & Omit<SVGProps<SVGGElement>, 'x' | 'y' | 'z' | 'd' | 'h' | 'w'>) {
  const z1 = z + h;
  return (
    <g opacity={opacity} {...rest}>
      <polygon points={pts([x + w, y, z], [x + w, y + d, z], [x + w, y + d, z1], [x + w, y, z1])} fill={right ?? shade(color, -0.28)} stroke={stroke} strokeWidth={0.6} />
      <polygon points={pts([x, y + d, z], [x + w, y + d, z], [x + w, y + d, z1], [x, y + d, z1])} fill={left ?? shade(color, -0.1)} stroke={stroke} strokeWidth={0.6} />
      <polygon points={pts([x, y, z1], [x + w, y, z1], [x + w, y + d, z1], [x, y + d, z1])} fill={top ?? shade(color, 0.18)} stroke={stroke} strokeWidth={0.6} />
      {children}
    </g>
  );
}

/** Rajola plana (terra, carrers, places) */
export function IsoTile({ x, y, z = 0, w, d, fill, stroke = 'none', ...rest }: { x: number; y: number; z?: number; w: number; d: number; fill: string; stroke?: string } & Omit<SVGProps<SVGPolygonElement>, 'x' | 'y' | 'z' | 'd' | 'w'>) {
  return <polygon points={pts([x, y, z], [x + w, y, z], [x + w, y + d, z], [x, y + d, z])} fill={fill} stroke={stroke} {...rest} />;
}

/** Cilindre vertical (torres, columnes, dipòsits) */
export function IsoCylinder({ cx, cy, z = 0, r, h, color, top }: { cx: number; cy: number; z?: number; r: number; h: number; color: string; top?: string }) {
  const [sx, sy] = P(cx, cy, z);
  const [, sy2] = P(cx, cy, z + h);
  const rx = r * S * Math.SQRT2, ry = rx / 2;
  return (
    <g>
      <path d={`M${sx - rx},${sy2} L${sx - rx},${sy} A${rx},${ry} 0 0 0 ${sx + rx},${sy} L${sx + rx},${sy2} Z`} fill={shade(color, -0.2)} />
      <path d={`M${sx},${sy2 + ry} L${sx},${sy + ry} A${rx},${ry} 0 0 0 ${sx + rx},${sy} L${sx + rx},${sy2} Z`} fill={shade(color, -0.35)} opacity={0.6} />
      <ellipse cx={sx} cy={sy2} rx={rx} ry={ry} fill={top ?? shade(color, 0.2)} />
    </g>
  );
}

/** Cúpula semiesfèrica de vidre */
export function IsoDome({ cx, cy, z, r, color, stroke }: { cx: number; cy: number; z: number; r: number; color: string; stroke: string }) {
  const [sx, sy] = P(cx, cy, z);
  const rx = r * S * Math.SQRT2, ry = rx / 2, rh = r * S * 1.15;
  const id = `dome-${Math.round(cx * 10)}-${Math.round(cy * 10)}-${color.slice(1)}`;
  return (
    <g>
      <defs>
        <radialGradient id={id} cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".9" />
          <stop offset=".45" stopColor={color} stopOpacity=".75" />
          <stop offset="1" stopColor={shade(color, -0.45)} stopOpacity=".95" />
        </radialGradient>
      </defs>
      <path d={`M${sx - rx},${sy} A${rx},${rh} 0 0 1 ${sx + rx},${sy} A${rx},${ry} 0 0 1 ${sx - rx},${sy} Z`} fill={`url(#${id})`} stroke={stroke} strokeWidth={1} />
      <path d={`M${sx - rx * 0.7},${sy - rh * 0.55} Q${sx},${sy - rh * 0.2} ${sx + rx * 0.7},${sy - rh * 0.55}`} fill="none" stroke={stroke} strokeWidth={0.8} opacity={0.7} />
      <path d={`M${sx},${sy - rh} L${sx},${sy + ry}`} stroke={stroke} strokeWidth={0.8} opacity={0.6} />
      <path d={`M${sx - rx * 0.55},${sy - rh * 0.8} Q${sx - rx * 0.2},${sy} ${sx - rx * 0.35},${sy + ry * 0.8}`} fill="none" stroke={stroke} strokeWidth={0.7} opacity={0.5} />
      <path d={`M${sx + rx * 0.55},${sy - rh * 0.8} Q${sx + rx * 0.2},${sy} ${sx + rx * 0.35},${sy + ry * 0.8}`} fill="none" stroke={stroke} strokeWidth={0.7} opacity={0.5} />
    </g>
  );
}

/** Arbre tecnològic: tronc + copa lluminosa */
export function TechTree({ x, y, z = 0, s = 1, color = '#34D399', glow = true }: { x: number; y: number; z?: number; s?: number; color?: string; glow?: boolean }) {
  const [bx, by] = P(x, y, z);
  return (
    <g>
      <ellipse cx={bx} cy={by} rx={7 * s} ry={3.5 * s} fill="rgba(0,0,0,.25)" />
      <rect x={bx - 1.4 * s} y={by - 16 * s} width={2.8 * s} height={16 * s} rx={1} fill="#64748B" />
      <circle cx={bx} cy={by - 21 * s} r={9 * s} fill={color} opacity={0.95} />
      <circle cx={bx - 3 * s} cy={by - 24 * s} r={4 * s} fill={shade(color, 0.4)} opacity={0.8} />
      {glow && <circle cx={bx} cy={by - 21 * s} r={12 * s} fill={color} opacity={0.18} className="anim-pulse" />}
      <circle cx={bx + 4 * s} cy={by - 18 * s} r={1.3 * s} fill="#fff" className="anim-pulse" />
    </g>
  );
}

/** Rètol flotant (noms d'edificis i cases) */
export function IsoLabel({ x, y, z, text, color = '#22D3EE', small }: { x: number; y: number; z: number; text: string; color?: string; small?: boolean }) {
  const [sx, sy] = P(x, y, z);
  const fs = small ? 9 : 11;
  const w = Math.max(28, text.length * fs * 0.6 + 14);
  return (
    <g pointerEvents="none">
      <rect x={sx - w / 2} y={sy - fs - 6} width={w} height={fs + 8} rx={(fs + 8) / 2} fill="rgba(8,12,32,.82)" stroke={color} strokeWidth={1} />
      <text x={sx} y={sy - 3.5} textAnchor="middle" fontSize={fs} fontFamily="Chakra Petch, sans-serif" fontWeight={600} fill="#fff">{text}</text>
    </g>
  );
}

/** Calcula el viewBox que conté una sèrie de punts de món */
export function viewBoxFor(corners: V3[], pad = 30) {
  const ps = corners.map(([x, y, z]) => P(x, y, z ?? 0));
  const xs = ps.map((p) => p[0]), ys = ps.map((p) => p[1]);
  const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad, minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad;
  return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
}
