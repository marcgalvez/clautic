/** Deterministic, dependency-free 32-bit FNV-1a hash (hex). */
export function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Fingerprint of the chess content of an exercise (position + solution line). */
export function exerciseFingerprint(ex: { fen: string; solution: string[]; alternatives?: Record<string, string[]> }): string {
  return fnv1a(`${ex.fen}|${ex.solution.join(' ')}|${JSON.stringify(ex.alternatives ?? {})}`);
}
