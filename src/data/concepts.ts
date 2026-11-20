/** Pedagogical concepts (competencies) with Catalan labels. */
export const CONCEPTS: Record<string, { label: string; area: 'tactics' | 'calculation' | 'threats' | 'opening' }> = {
  'peces-indefenses': { label: 'Detectar peces indefenses', area: 'threats' },
  'revisio-captures': { label: 'Revisar totes les captures', area: 'calculation' },
  'revisio-escacs': { label: 'Revisar tots els escacs', area: 'calculation' },
  'forquilla-cavall': { label: 'Forquilla de cavall', area: 'tactics' },
  'forquilla-peo': { label: 'Forquilla de peó', area: 'tactics' },
  'atac-doble-dama': { label: 'Atac doble de dama', area: 'tactics' },
  enfilada: { label: 'Enfilada', area: 'tactics' },
  'clavada-absoluta': { label: 'Clavada absoluta', area: 'tactics' },
  'atacar-peca-clavada': { label: 'Atacar la peça clavada', area: 'tactics' },
  'atac-descobert': { label: 'Atac descobert', area: 'tactics' },
  'escac-doble': { label: 'Escac doble', area: 'tactics' },
  'mat-fila-darrere': { label: 'Mat a la fila del darrere', area: 'tactics' },
  'mat-dama-alfil': { label: 'Mat amb dama i alfil', area: 'tactics' },
  'mat-ofegat': { label: 'Mat de la coça', area: 'tactics' },
  'mat-anastasia': { label: "Mat d'Anastàsia", area: 'tactics' },
  'punt-feble-f7': { label: 'El punt feble f7/f2', area: 'opening' },
  'seguretat-del-rei': { label: 'Seguretat del rei', area: 'opening' },
  sacrifici: { label: 'Sacrificis', area: 'calculation' },
  desviacio: { label: 'Desviació', area: 'tactics' },
  atraccio: { label: 'Atracció', area: 'tactics' },
};

export function conceptLabel(id: string): string {
  return CONCEPTS[id]?.label ?? id;
}
