/** Catalan labels for themes and categories. */
export const THEME_LABELS: Record<string, string> = {
  'hanging-piece': 'Peces indefenses',
  fork: 'Forquilles',
  pin: 'Clavades',
  skewer: 'Enfilades',
  'discovered-attack': 'Atacs descoberts',
  'double-attack': 'Atacs dobles',
  deflection: 'Desviacions',
  attraction: 'Atraccions',
  mate: 'Mats',
  'back-rank': 'Mat a la fila del darrere',
  'smothered-mate': 'Mat de la coça',
  combination: 'Combinacions',
  'threat-detection': "Detecció d'amenaces",
  opposition: 'Oposició',
  'pawn-race': 'Curses de peons',
  simplification: 'Simplificació',
  'king-safety': 'Seguretat del rei',
  development: 'Desenvolupament',
};

export const CATEGORY_LABELS: Record<string, string> = {
  tactics: 'Tàctica',
  strategy: 'Estratègia',
  endgame: 'Finals',
  opening: 'Obertures',
};

/** Theme groups used to build sessions (a lesson trains a family of themes). */
export const THEME_FAMILIES: Record<string, string[]> = {
  'double-attacks': ['fork', 'double-attack', 'skewer'],
  'pins-and-discoveries': ['pin', 'discovered-attack'],
  'king-attack': ['mate', 'back-rank', 'smothered-mate', 'combination'],
  'loose-pieces': ['hanging-piece', 'fork', 'double-attack'],
  sacrifices: ['deflection', 'attraction', 'combination'],
};

export function themeLabel(theme: string): string {
  return THEME_LABELS[theme] ?? theme;
}

export function difficultyLabel(d: number): string {
  return ['', 'Inicial', 'Fàcil', 'Intermèdia', 'Avançada', 'Experta'][d] ?? String(d);
}
