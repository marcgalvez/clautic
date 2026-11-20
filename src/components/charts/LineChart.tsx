import { useEffect, useId, useRef, useState } from 'react';

export interface LinePoint {
  label: string; // shown in the tooltip and on the x axis ends
  value: number;
}

/**
 * Single-series line chart (inline SVG). One series only: compare series with
 * small multiples, never with a second axis.
 */
export function LineChart({
  points,
  height = 140,
  format = (v) => String(Math.round(v)),
  ariaLabel,
  domain,
}: {
  points: LinePoint[];
  height?: number;
  format?: (v: number) => string;
  ariaLabel: string;
  /** Fixed y domain (e.g. [0, 100] for percentages). */
  domain?: [number, number];
}) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(200, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  if (points.length < 2) {
    return (
      <div ref={boxRef} className="flex items-center rounded-md bg-muted/50 p-3 text-sm text-muted-foreground" style={{ minHeight: Math.min(height, 90) }}>
        {points.length === 0 ? 'Encara no hi ha dades.' : `Un sol registre (${format(points[0].value)}): l'evolució apareixerà amb més dades.`}
      </div>
    );
  }
  // The viewBox matches the rendered width so labels keep their real size.
  const W = width;
  const H = height;
  const pad = { l: 44, r: 12, t: 12, b: 22 };
  const values = points.map((p) => p.value);
  let [min, max] = domain ?? [Math.min(...values), Math.max(...values)];
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min;
  if (!domain) {
    min -= span * 0.1;
    max += span * 0.1;
  }
  const x = (i: number) => pad.l + (points.length === 1 ? (W - pad.l - pad.r) / 2 : (i / (points.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${path} L${x(points.length - 1).toFixed(1)},${H - pad.b} L${x(0).toFixed(1)},${H - pad.b} Z`;
  const ticks = [min, (min + max) / 2, max];
  const last = points.length - 1;
  const h = hover ?? null;

  return (
    <figure ref={boxRef} className="relative" aria-label={ariaLabel}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-visible" role="img" aria-label={ariaLabel}>
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted-foreground)">
              {format(t)}
            </text>
          </g>
        ))}
        <path d={area} fill={`url(#${id}-fill)`} />
        <path d={path} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(last)} cy={y(points[last].value)} r={4} fill="var(--primary)" stroke="var(--card)" strokeWidth={2} />
        {h !== null && (
          <>
            <line x1={x(h)} x2={x(h)} y1={pad.t} y2={H - pad.b} stroke="var(--muted-foreground)" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={x(h)} cy={y(points[h].value)} r={4} fill="var(--primary)" stroke="var(--card)" strokeWidth={2} />
          </>
        )}
        <text x={pad.l} y={H - 4} fontSize={11} fill="var(--muted-foreground)">{points[0].label}</text>
        {last > 0 && (
          <text x={W - pad.r} y={H - 4} fontSize={11} textAnchor="end" fill="var(--muted-foreground)">{points[last].label}</text>
        )}
        {/* hit targets wider than the marks */}
        {points.map((p, i) => (
          <rect
            key={i}
            x={x(i) - (W - pad.l - pad.r) / Math.max(1, points.length - 1) / 2}
            y={pad.t}
            width={Math.max(8, (W - pad.l - pad.r) / Math.max(1, points.length - 1))}
            height={H - pad.t - pad.b}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <title>{`${p.label}: ${format(p.value)}`}</title>
          </rect>
        ))}
      </svg>
      {h !== null && (
        <figcaption className="pointer-events-none absolute top-0 right-0 rounded-md border border-border bg-card px-2 py-1 text-xs shadow-sm">
          {points[h].label}: <span className="font-semibold tabular-nums">{format(points[h].value)}</span>
        </figcaption>
      )}
    </figure>
  );
}
