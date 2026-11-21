import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { fmt, getT } from "@/lib/i18n";
import { publicOrg } from "@/lib/public/org";
import { fmtPrice } from "@/lib/format";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { LocaleSwitch } from "@/components/LocaleSwitch";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await publicOrg((await params).slug);
  return { title: p ? p.org.name : "Reserves", robots: p?.active ? undefined : { index: false } };
}

export default async function BookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await publicOrg(slug);
  if (!p) notFound();
  const { t, locale } = await getT(p.settings.defaultLocale);
  const s = p.settings;

  const header = (
    <header className="mb-6 flex items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        {s.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.logoUrl} alt="" className="h-12 w-12 rounded-xl object-cover" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-lg font-bold text-white" aria-hidden>
            {p.org.name.slice(0, 1)}
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold">{p.org.name}</h1>
          {s.address && <p className="text-sm text-stone-600">{s.address}</p>}
        </div>
      </div>
      <LocaleSwitch current={locale} />
    </header>
  );

  if (!p.active) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10" style={{ "--accent": s.accentColor } as React.CSSProperties}>
        {header}
        <div className="card text-center">
          <h2 className="text-lg font-semibold">{t.booking.unavailableTitle}</h2>
          <p className="mt-2 text-stone-600">{t.booking.unavailableText}</p>
          {s.phone && <a className="btn-secondary mt-4" href={`tel:${s.phone}`}>{s.phone}</a>}
        </div>
      </main>
    );
  }

  const [services, pros] = await Promise.all([
    db.service.findMany({ where: { organizationId: p.org.id, active: true, professionals: { some: { professional: { active: true } } } }, include: { professionals: { where: { professional: { active: true } } } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.professional.findMany({ where: { organizationId: p.org.id, active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, color: true } }),
  ]);
  const contact = s.privacyContactEmail ? ` (${s.privacyContactEmail})` : "";

  return (
    <main className="mx-auto max-w-xl px-4 py-6 sm:py-10" style={{ "--accent": s.accentColor } as React.CSSProperties}>
      {header}
      <BookingFlow
        slug={slug}
        locale={locale}
        t={t.booking}
        weekdaysShort={t.common.weekdaysShort}
        minutesLabel={t.common.minutes}
        emailRequirement={s.emailRequirement}
        services={services.map((x) => ({ id: x.id, name: x.name, description: x.description, duration: x.durationMinutes, price: fmtPrice(x.priceCents, locale), professionalIds: x.professionals.map((ps) => ps.professionalId) }))}
        professionals={pros}
        privacyText={s.privacyPolicy || fmt(t.booking.privacyDefault, { center: p.org.name, contact })}
        termsText={[s.bookingTerms, s.cancellationPolicy].filter(Boolean).join("\n\n")}
        remindersEnabled={s.remindersEnabled}
      />
      <p className="mt-10 text-center text-xs text-stone-400">
        {t.booking.poweredBy} {t.common.appName}
      </p>
    </main>
  );
}
