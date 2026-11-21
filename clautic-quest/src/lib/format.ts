const dtf = new Intl.DateTimeFormat('ca-ES', { day: 'numeric', month: 'short' });
const dtfY = new Intl.DateTimeFormat('ca-ES', { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtDate = (d?: string | null, year = false) => (d ? (year ? dtfY : dtf).format(new Date(d)) : '—');
export function timeAgo(d: string) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'ara mateix';
  if (s < 3600) return `fa ${Math.floor(s / 60)} min`;
  if (s < 86400) return `fa ${Math.floor(s / 3600)} h`;
  if (s < 86400 * 7) return `fa ${Math.floor(s / 86400)} dies`;
  return fmtDate(d);
}
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const MONTHS = ['gen', 'feb', 'mar', 'abr', 'maig', 'juny', 'jul', 'ag', 'set', 'oct', 'nov', 'des'];
