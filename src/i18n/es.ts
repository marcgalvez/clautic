import type { MessageKey } from './ca';

/** Spanish — partial. Missing keys fall back to Catalan. */
export const es: Partial<Record<MessageKey, string>> = {
  'app.tagline': 'Tu entrenador personal de ajedrez',
  'nav.home': 'Inicio',
  'nav.train': 'Entrenar',
  'nav.exercises': 'Ejercicios',
  'nav.analysis': 'Tablero y análisis',
  'nav.progress': 'Progreso',
  'nav.games': 'Partidas',
  'nav.profile': 'Perfil',
  'nav.settings': 'Configuración',
  'theme.light': 'Claro',
  'theme.dark': 'Oscuro',
  'theme.system': 'Sistema',
  'board.flip': 'Girar tablero',
  'board.undo': 'Deshacer',
  'board.whiteToMove': 'Juegan las blancas',
  'board.blackToMove': 'Juegan las negras',
  'board.checkmate': 'Jaque mate',
  'common.start': 'Empezar',
  'common.continue': 'Continuar',
  'common.back': 'Volver',
  'common.next': 'Siguiente',
};
