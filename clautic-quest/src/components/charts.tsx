// Gràfics SVG lleugers (sense dependències)
export function Bars({ data, color = '#22D3EE', height = 140, format = (v: number) => String(v) }: {
  data: { label: string; value: number; color?: string }[]; color?: string; height?: number; format?: (v: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
          <span className="text-[10px] font-semibold text-ice/60 opacity-0 transition group-hover:opacity-100">{format(d.value)}</span>
          <div className="w-full rounded-t-md transition-all duration-500"
            style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 3 : 0, background: `linear-gradient(180deg, ${d.color ?? color}, ${(d.color ?? color)}66)` }}
            title={`${d.label}: ${format(d.value)}`} />
          <span className="w-full truncate text-center text-[10px] text-ice/50">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function HBars({ data, format = (v: number) => String(v) }: { data: { label: string; value: number; color: string; icon?: string }[]; format?: (v: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-2 text-sm">
          <span className="w-6 text-center">{d.icon}</span>
          <span className="w-28 truncate text-ice/80">{d.label}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/5">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(d.value / max) * 100}%`, background: d.color }} />
          </div>
          <span className="w-10 text-right font-semibold tabular-nums">{format(d.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function Sparkline({ values, color = '#22D3EE', width = 90, height = 28 }: { values: number[]; color?: string; width?: number; height?: number }) {
  if (!values.length) return null;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * width},${height - (v / max) * (height - 4) - 2}`).join(' ');
  return (
    <svg width={width} height={height} aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Donut({ parts, size = 120 }: { parts: { value: number; color: string; label: string }[]; size?: number }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  let acc = 0;
  const r = 42, c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="12" />
      {parts.map((p) => {
        const len = (p.value / total) * c;
        const el = <circle key={p.label} cx="50" cy="50" r={r} fill="none" stroke={p.color} strokeWidth="12"
          strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acc} transform="rotate(-90 50 50)" />;
        acc += len;
        return el;
      })}
    </svg>
  );
}
