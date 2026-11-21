import Link from "next/link";
import { getT } from "@/lib/i18n";
import { LocaleSwitch } from "@/components/LocaleSwitch";

export default async function Landing() {
  const { t, locale } = await getT();
  const features = [
    [t.landing.f1, t.landing.f1d, "🔗"],
    [t.landing.f2, t.landing.f2d, "📅"],
    [t.landing.f3, t.landing.f3d, "💬"],
  ];
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-16">
      <header className="mb-16 flex items-center justify-between">
        <span className="text-lg font-bold">{t.common.appName}</span>
        <div className="flex items-center gap-3">
          <LocaleSwitch current={locale} />
          <Link href="/login" className="btn-ghost">
            {t.landing.login}
          </Link>
        </div>
      </header>
      <section className="max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">{t.landing.title}</h1>
        <p className="mt-6 text-lg text-stone-600">{t.landing.subtitle}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/registre" className="btn-primary px-6 text-base">
            {t.landing.cta}
          </Link>
        </div>
      </section>
      <section className="mt-16 grid gap-4 sm:grid-cols-3">
        {features.map(([title, desc, icon]) => (
          <div key={title} className="card">
            <div className="text-2xl" aria-hidden>
              {icon}
            </div>
            <h2 className="mt-3 font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-stone-600">{desc}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
