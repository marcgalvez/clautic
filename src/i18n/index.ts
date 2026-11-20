import { ca, type MessageKey } from './ca';
import { es } from './es';
import { en } from './en';
import type { Locale } from '@/lib/storage/types';

const dictionaries: Record<Locale, Partial<Record<MessageKey, string>>> = { ca, es, en };

export const LOCALES: { id: Locale; label: string; complete: boolean }[] = [
  { id: 'ca', label: 'Català', complete: true },
  { id: 'es', label: 'Castellano', complete: false },
  { id: 'en', label: 'English', complete: false },
];

export function translate(locale: Locale, key: MessageKey): string {
  return dictionaries[locale][key] ?? ca[key];
}

export type { MessageKey };
