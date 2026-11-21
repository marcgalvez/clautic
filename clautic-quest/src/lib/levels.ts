/** Mateixa corba que al servidor: per passar del nivell L al L+1 calen 60 + 20·(L-1) XP. */
export const xpForLevel = (l: number) => 60 * (l - 1) + 10 * (l - 1) * (l - 2);
export function levelForXp(xp: number) {
  let l = 1;
  while (xpForLevel(l + 1) <= xp) l++;
  return l;
}
export function levelProgress(xp: number) {
  const l = levelForXp(xp);
  const a = xpForLevel(l), b = xpForLevel(l + 1);
  return { level: l, pct: Math.min(100, Math.round(((xp - a) / (b - a)) * 100)), toNext: b - xp };
}
export const LEVEL_TITLES = ['Aprenent', 'Explorador/a', 'Constructor/a', 'Inventor/a', 'Enginyer/a', 'Arquitecte/a', 'Mestre/a', 'Llegenda'];
export const levelTitle = (l: number) => LEVEL_TITLES[Math.min(LEVEL_TITLES.length - 1, Math.floor((l - 1) / 3))];
