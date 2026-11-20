import type { MessageKey } from './ca';

/** English — partial. Missing keys fall back to Catalan. */
export const en: Partial<Record<MessageKey, string>> = {
  'app.tagline': 'Your personal chess coach',
  'nav.home': 'Home',
  'nav.train': 'Train',
  'nav.exercises': 'Exercises',
  'nav.analysis': 'Board & analysis',
  'nav.progress': 'Progress',
  'nav.games': 'Games',
  'nav.profile': 'Profile',
  'nav.settings': 'Settings',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'theme.system': 'System',
  'board.flip': 'Flip board',
  'board.undo': 'Undo',
  'board.whiteToMove': 'White to move',
  'board.blackToMove': 'Black to move',
  'board.checkmate': 'Checkmate',
  'common.start': 'Start',
  'common.continue': 'Continue',
  'common.back': 'Back',
  'common.next': 'Next',
};
