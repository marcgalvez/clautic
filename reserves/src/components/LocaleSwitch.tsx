import { setLocale } from "@/app/actions/locale";
import { LOCALES, type Locale } from "@/lib/i18n";

export function LocaleSwitch({ current }: { current: Locale }) {
  return (
    <form action={setLocale} className="flex gap-1" aria-label="Idioma / Idioma">
      {LOCALES.map((l) => (
        <button key={l} name="locale" value={l} aria-pressed={l === current} className={`rounded-md px-2 py-1 text-xs font-semibold uppercase ${l === current ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-200"}`}>
          {l}
        </button>
      ))}
    </form>
  );
}
