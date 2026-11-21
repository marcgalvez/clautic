import Link from "next/link";
import { LocaleSwitch } from "./LocaleSwitch";
import type { Locale } from "@/lib/i18n";

export function AuthShell({ title, intro, locale, children, footer }: { title: string; intro?: string; locale: Locale; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="font-bold">
          Reserves
        </Link>
        <LocaleSwitch current={locale} />
      </div>
      <div className="card p-6">
        <h1 className="text-xl font-bold">{title}</h1>
        {intro && <p className="mt-1 text-sm text-stone-600">{intro}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <p className="mt-4 text-center text-sm text-stone-600">{footer}</p>}
    </main>
  );
}
