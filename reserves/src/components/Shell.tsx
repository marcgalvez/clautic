import Link from "next/link";
import { Nav } from "./Nav";
import { LocaleSwitch } from "./LocaleSwitch";
import { logoutAction } from "@/app/actions/auth";
import type { Locale } from "@/lib/i18n";

export function Shell(props: { brand: string; subtitle?: string; items: { href: string; label: string; icon: string }[]; locale: Locale; logoutLabel: string; userName: string; banner?: React.ReactNode; accent?: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="min-h-dvh lg:flex" style={props.accent ? ({ "--accent": props.accent } as React.CSSProperties) : undefined}>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:rounded focus:bg-white focus:p-2">
        Salta al contingut
      </a>
      <aside className="border-b border-stone-200 bg-white px-3 py-3 lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0 lg:py-5">
        <div className="mb-3 flex items-center justify-between px-2 lg:mb-6 lg:block">
          <Link href="/" className="block">
            <div className="truncate font-bold">{props.brand}</div>
            {props.subtitle && <div className="truncate text-xs text-stone-500">{props.subtitle}</div>}
          </Link>
          <div className="lg:hidden">
            <LocaleSwitch current={props.locale} />
          </div>
        </div>
        <Nav items={props.items} />
        <div className="mt-6 hidden space-y-3 px-2 lg:block">
          {props.extra}
          <div className="text-xs text-stone-500">{props.userName}</div>
          <div className="flex items-center justify-between">
            <LocaleSwitch current={props.locale} />
            <form action={logoutAction}>
              <button className="text-sm text-stone-600 underline">{props.logoutLabel}</button>
            </form>
          </div>
        </div>
      </aside>
      <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        {props.banner}
        {props.children}
        <form action={logoutAction} className="mt-10 lg:hidden">
          <button className="text-sm text-stone-600 underline">{props.logoutLabel}</button>
        </form>
      </main>
    </div>
  );
}
