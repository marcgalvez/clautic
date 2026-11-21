import { cookies, headers } from "next/headers";
import { ca, type Dict } from "./ca";
import { es } from "./es";

// Per afegir un idioma: crea el diccionari (tipat amb Dict) i afegeix-lo aquí.
export const LOCALES = ["ca", "es"] as const;
export type Locale = (typeof LOCALES)[number];
const DICTS: Record<Locale, Dict> = { ca, es };
export const LOCALE_COOKIE = "lang";

export const isLocale = (v: unknown): v is Locale => LOCALES.includes(v as Locale);

export async function getLocale(fallback?: string): Promise<Locale> {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(c)) return c;
  if (isLocale(fallback)) return fallback;
  const al = (await headers()).get("accept-language") ?? "";
  const m = al.toLowerCase().match(/\b(ca|es)\b/);
  return m && isLocale(m[1]) ? m[1] : "ca";
}

export const dict = (l: Locale): Dict => DICTS[l];

export async function getT(fallback?: string) {
  const locale = await getLocale(fallback);
  return { t: DICTS[locale], locale };
}

export function fmt(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}
