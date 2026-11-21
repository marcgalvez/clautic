// Intervals semioberts [start, end) en mil·lisegons UTC.
export type Interval = { start: number; end: number };

export const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

export function mergeIntervals(list: Interval[]): Interval[] {
  const s = list.filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const i of s) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push({ ...i });
  }
  return out;
}

export function intersectIntervals(a: Interval[], b: Interval[]): Interval[] {
  const out: Interval[] = [];
  for (const x of mergeIntervals(a))
    for (const y of mergeIntervals(b)) {
      const start = Math.max(x.start, y.start);
      const end = Math.min(x.end, y.end);
      if (end > start) out.push({ start, end });
    }
  return mergeIntervals(out);
}

/** Resta `cut` de cada interval de `list`. */
export function subtractInterval(list: Interval[], cut: Interval): Interval[] {
  const out: Interval[] = [];
  for (const i of list) {
    if (!overlaps(i, cut)) {
      out.push(i);
      continue;
    }
    if (i.start < cut.start) out.push({ start: i.start, end: cut.start });
    if (i.end > cut.end) out.push({ start: cut.end, end: i.end });
  }
  return out;
}
