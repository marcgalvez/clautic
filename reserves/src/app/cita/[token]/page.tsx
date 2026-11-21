import { findByManageToken, customerCanChange } from "@/lib/booking/service";
import { fmt, getT } from "@/lib/i18n";
import { fmtDate, fmtTime, ucfirst } from "@/lib/format";
import { accessState } from "@/lib/auth/access";
import { LocaleSwitch } from "@/components/LocaleSwitch";
import { ManageActions } from "@/components/booking/ManageActions";

export const dynamic = "force-dynamic";
export const metadata = { title: "La teva cita", robots: { index: false } };

export default async function ManagePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const a = await findByManageToken(token);
  const { t, locale } = await getT(a?.customer.locale);
  if (!a) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="card">{t.manage.notFound}</p>
      </main>
    );
  }
  const s = a.organization.settings!;
  const tz = s.timezone;
  const past = a.startsAt < new Date();
  const can = customerCanChange(a, s) && accessState(a.organization, a.organization.subscription) === "ACTIVE";
  return (
    <main className="mx-auto max-w-md px-4 py-8" style={{ "--accent": s.accentColor } as React.CSSProperties}>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">{t.manage.title}</h1>
        <LocaleSwitch current={locale} />
      </div>
      <section className="card">
        <div className="text-sm text-stone-500">{a.organization.name}</div>
        <div className="mt-1 text-lg font-semibold">{ucfirst(fmtDate(a.startsAt, tz, locale))}</div>
        <div className="text-3xl font-bold tabular-nums">{fmtTime(a.startsAt, tz)}</div>
        <dl className="mt-4 space-y-1 text-sm">
          <div><dt className="inline text-stone-500">{t.booking.service}: </dt><dd className="inline font-medium">{a.serviceName} · {a.durationMinutes} {t.common.minutes}</dd></div>
          <div><dt className="inline text-stone-500">{t.booking.professional}: </dt><dd className="inline font-medium">{a.professional.name}</dd></div>
          {s.address && <div><dt className="inline text-stone-500">{t.booking.address}: </dt><dd className="inline font-medium">{s.address}</dd></div>}
        </dl>
        {a.status === "CANCELLED" && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{t.manage.cancelled}</p>}
        {past && a.status !== "CANCELLED" && <p className="mt-4 rounded-lg bg-stone-100 p-3 text-sm">{t.manage.past}</p>}
      </section>
      {a.status !== "CANCELLED" && !past && (
        <>
          {can && (s.allowCustomerCancel || s.allowCustomerReschedule) ? (
            <ManageActions token={token} locale={locale} t={t.manage} booking={t.booking} weekdaysShort={t.common.weekdaysShort} allowCancel={s.allowCustomerCancel} allowReschedule={s.allowCustomerReschedule} />
          ) : (
            <p className="mt-4 text-sm text-stone-600">{s.allowCustomerCancel || s.allowCustomerReschedule ? fmt(t.manage.deadline, { hours: s.cancelDeadlineHours }) : t.manage.notAllowed}</p>
          )}
          {s.phone && <a href={`tel:${s.phone}`} className="btn-secondary mt-4 w-full">📞 {s.phone}</a>}
          {s.cancellationPolicy && <p className="mt-4 text-xs whitespace-pre-line text-stone-500">{s.cancellationPolicy}</p>}
        </>
      )}
    </main>
  );
}
