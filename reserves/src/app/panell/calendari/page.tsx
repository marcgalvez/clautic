import Link from "next/link";
import { DateTime } from "luxon";
import { db } from "@/lib/db";
import { appointmentScope, isOrgAdmin, requireOrg } from "@/lib/auth/guards";
import { getT } from "@/lib/i18n";
import { PageHeader } from "@/components/ui";
import { ucfirst } from "@/lib/format";

type View = "day" | "week" | "month";
const PX = 1.1; // píxels per minut

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string; pro?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireOrg();
  const { t, locale } = await getT(ctx.user.locale);
  const tc = t.dash.cal;
  const settings = await db.organizationSettings.findUniqueOrThrow({ where: { organizationId: ctx.orgId } });
  const tz = settings.timezone;
  const view: View = sp.view === "day" || sp.view === "month" ? sp.view : "week";
  const base = (sp.date && DateTime.fromISO(sp.date, { zone: tz }).isValid ? DateTime.fromISO(sp.date, { zone: tz }) : DateTime.now().setZone(tz)).startOf("day").setLocale(locale);
  const isPro = ctx.role === "PROFESSIONAL";
  const proFilter = isPro ? ctx.professionalId : sp.pro || null;

  const start = view === "day" ? base : view === "week" ? base.startOf("week") : base.startOf("month").startOf("week");
  const end = view === "day" ? base.endOf("day") : view === "week" ? base.endOf("week") : base.endOf("month").endOf("week");

  const [pros, appts, blocks, hours] = await Promise.all([
    db.professional.findMany({ where: { organizationId: ctx.orgId, active: true, ...(isPro ? { id: ctx.professionalId ?? "" } : {}) }, orderBy: { sortOrder: "asc" } }),
    db.appointment.findMany({
      where: { ...appointmentScope(ctx), startsAt: { gte: start.toJSDate(), lte: end.toJSDate() }, status: { not: "CANCELLED" }, ...(proFilter ? { professionalId: proFilter } : {}) },
      include: { customer: true, professional: true },
      orderBy: { startsAt: "asc" },
    }),
    db.timeOff.findMany({ where: { organizationId: ctx.orgId, startsAt: { lte: end.toJSDate() }, endsAt: { gte: start.toJSDate() }, ...(proFilter ? { OR: [{ professionalId: proFilter }, { professionalId: null }] } : {}) } }),
    db.businessHours.findMany({ where: { organizationId: ctx.orgId } }),
  ]);

  const minM = Math.min(480, ...hours.map((h) => h.startMinute), ...appts.map((a) => DateTime.fromJSDate(a.startsAt).setZone(tz).hour * 60));
  const maxM = Math.max(1200, ...hours.map((h) => h.endMinute), ...appts.map((a) => { const e = DateTime.fromJSDate(a.endsAt).setZone(tz); return e.hour * 60 + e.minute; }));
  const dayStartM = Math.floor(minM / 60) * 60;
  const dayEndM = Math.ceil(maxM / 60) * 60;

  const qs = (o: Record<string, string | null | undefined>) => {
    const p = new URLSearchParams();
    const merged = { view, date: base.toISODate(), pro: sp.pro, ...o };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/panell/calendari?${p}`;
  };
  const step = { day: { days: 1 }, week: { weeks: 1 }, month: { months: 1 } }[view];
  const title = view === "day" ? base.toFormat("cccc d LLLL yyyy") : view === "week" ? `${start.toFormat("d LLL")} – ${end.toFormat("d LLL yyyy")}` : base.toFormat("LLLL yyyy");

  const local = (d: Date) => DateTime.fromJSDate(d).setZone(tz);
  const minuteOf = (d: Date) => { const l = local(d); return l.hour * 60 + l.minute; };

  /** Columna de temps: cites i bloquejos posicionats en vertical. */
  const Column = ({ day, list, blk }: { day: DateTime; list: typeof appts; blk: typeof blocks }) => {
    const ds = day.startOf("day");
    const de = day.endOf("day");
    return (
      <div className="relative border-l border-stone-200" style={{ height: (dayEndM - dayStartM) * PX }}>
        {Array.from({ length: (dayEndM - dayStartM) / 60 }).map((_, i) => (
          <div key={i} className="absolute inset-x-0 border-t border-stone-100" style={{ top: i * 60 * PX }} />
        ))}
        {blk.map((b) => {
          const s = Math.max(b.startsAt.getTime(), ds.toMillis());
          const e = Math.min(b.endsAt.getTime(), de.toMillis());
          if (e <= s) return null;
          const top = Math.max(0, (minuteOf(new Date(s)) - dayStartM) * PX);
          const bottom = Math.min((dayEndM - dayStartM) * PX, (e >= de.toMillis() ? dayEndM : minuteOf(new Date(e))) * PX - dayStartM * PX);
          return (
            <div key={b.id} className="absolute inset-x-0 overflow-hidden bg-[repeating-linear-gradient(45deg,#e7e5e4_0,#e7e5e4_6px,#f5f5f4_6px,#f5f5f4_12px)] px-1 text-[10px] text-stone-600" style={{ top, height: Math.max(12, bottom - top) }} title={b.reason ?? tc.blocked}>
              {b.reason ?? tc.blocked}
            </div>
          );
        })}
        {list.map((a) => {
          const top = (minuteOf(a.startsAt) - dayStartM) * PX;
          const h = Math.max(22, a.durationMinutes * PX);
          return (
            <Link key={a.id} href={`/panell/cites/${a.id}`} className="absolute inset-x-0.5 overflow-hidden rounded-md px-1.5 py-0.5 text-[11px] leading-tight text-white shadow-sm hover:brightness-110" style={{ top, height: h, background: a.professional.color, opacity: a.status === "NO_SHOW" ? 0.5 : 1 }}>
              <span className="font-semibold tabular-nums">{local(a.startsAt).toFormat("HH:mm")}</span> {a.customer.firstName} {a.customer.lastName.slice(0, 1)}.
              <span className="block truncate opacity-90">{a.serviceName}{a.googleSyncStatus === "FAILED" ? " ⚠" : ""}</span>
            </Link>
          );
        })}
      </div>
    );
  };

  const Hours = () => (
    <div className="relative w-12 shrink-0" style={{ height: (dayEndM - dayStartM) * PX }} aria-hidden>
      {Array.from({ length: (dayEndM - dayStartM) / 60 }).map((_, i) => (
        <div key={i} className="absolute right-1 -translate-y-1/2 text-[10px] text-stone-500 tabular-nums" style={{ top: i * 60 * PX }}>
          {i > 0 ? `${String(dayStartM / 60 + i).padStart(2, "0")}:00` : ""}
        </div>
      ))}
    </div>
  );

  const days = view === "week" ? Array.from({ length: 7 }, (_, i) => start.plus({ days: i })) : [base];
  const sameDay = (d: Date, day: DateTime) => local(d).hasSame(day, "day");
  const overlapsDay = (b: { startsAt: Date; endsAt: Date }, day: DateTime) => b.startsAt < day.endOf("day").toJSDate() && b.endsAt > day.startOf("day").toJSDate();
  const columns =
    view === "day" && !proFilter && pros.length > 1
      ? pros.map((p) => ({ key: p.id, label: p.name, day: base, list: appts.filter((a) => a.professionalId === p.id), blk: blocks.filter((b) => (b.professionalId === p.id || !b.professionalId) && overlapsDay(b, base)) }))
      : days.map((d) => ({ key: d.toISODate()!, label: d.toFormat(view === "week" ? "ccc d" : "cccc d"), day: d, list: appts.filter((a) => sameDay(a.startsAt, d)), blk: blocks.filter((b) => overlapsDay(b, d)) }));

  return (
    <>
      <PageHeader
        title={t.dash.nav.calendar}
        actions={
          isOrgAdmin(ctx) && (
            <>
              <Link href={`/panell/cites/nova?date=${base.toISODate()}`} className="btn-primary">+ {tc.newAppt}</Link>
              <Link href={`/panell/bloquejos?date=${base.toISODate()}`} className="btn-secondary">⛔ {tc.newBlock}</Link>
            </>
          )
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-stone-300 bg-white p-0.5" role="group">
          {(["day", "week", "month"] as View[]).map((v) => (
            <Link key={v} href={qs({ view: v })} aria-current={v === view ? "page" : undefined} className={`rounded-md px-3 py-1.5 text-sm font-medium ${v === view ? "bg-stone-900 text-white" : "text-stone-700"}`}>
              {tc[v]}
            </Link>
          ))}
        </div>
        <Link href={qs({ date: base.minus(step).toISODate() })} className="btn-ghost px-3" aria-label="Anterior">←</Link>
        <Link href={qs({ date: DateTime.now().setZone(tz).toISODate() })} className="btn-secondary">{tc.today}</Link>
        <Link href={qs({ date: base.plus(step).toISODate() })} className="btn-ghost px-3" aria-label="Següent">→</Link>
        <h2 className="ml-2 text-lg font-semibold">{ucfirst(title)}</h2>
      </div>
      {!isPro && pros.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Link href={qs({ pro: "" })} className={`rounded-full px-3 py-1 text-sm ring-1 ${!proFilter ? "bg-stone-900 text-white ring-stone-900" : "bg-white ring-stone-300"}`}>{tc.allPros}</Link>
          {pros.map((p) => (
            <Link key={p.id} href={qs({ pro: p.id })} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ring-1 ${proFilter === p.id ? "bg-stone-900 text-white ring-stone-900" : "bg-white ring-stone-300"}`}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} aria-hidden />
              {p.name}
            </Link>
          ))}
        </div>
      )}

      {view === "month" ? (
        <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
          <div className="grid min-w-[44rem] grid-cols-7 border-b border-stone-200 text-center text-xs font-semibold text-stone-500">
            {t.common.weekdaysShort.map((w) => <div key={w} className="py-2">{w}</div>)}
          </div>
          <div className="grid min-w-[44rem] grid-cols-7">
            {Array.from({ length: Math.round(end.diff(start, "days").days) + 1 }, (_, i) => start.plus({ days: i })).map((d) => {
              const list = appts.filter((a) => sameDay(a.startsAt, d));
              const blocked = blocks.some((b) => b.startsAt <= d.startOf("day").toJSDate() && b.endsAt >= d.endOf("day").toJSDate());
              return (
                <div key={d.toISODate()} className={`min-h-28 border-r border-b border-stone-100 p-1.5 ${d.month !== base.month ? "bg-stone-50 text-stone-400" : ""} ${blocked ? "bg-stone-100" : ""}`}>
                  <Link href={qs({ view: "day", date: d.toISODate() })} className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${d.hasSame(DateTime.now().setZone(tz), "day") ? "bg-accent text-white" : ""}`}>
                    {d.day}
                  </Link>
                  <ul className="mt-1 space-y-0.5">
                    {list.slice(0, 3).map((a) => (
                      <li key={a.id}>
                        <Link href={`/panell/cites/${a.id}`} className="block truncate rounded px-1 text-[11px] text-white" style={{ background: a.professional.color }}>
                          {local(a.startsAt).toFormat("HH:mm")} {a.customer.firstName}
                        </Link>
                      </li>
                    ))}
                    {list.length > 3 && <li className="px-1 text-[11px] text-stone-500">+{list.length - 3}</li>}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
          <div className={columns.length > 1 ? "min-w-[48rem]" : ""}>
            <div className="sticky top-0 z-10 flex border-b border-stone-200 bg-white">
              <div className="w-12 shrink-0" />
              {columns.map((c) => (
                <div key={c.key} className="flex-1 border-l border-stone-200 px-2 py-2 text-center text-sm font-semibold">
                  {view === "week" ? <Link href={qs({ view: "day", date: c.key })}>{ucfirst(c.label)}</Link> : ucfirst(c.label)}
                </div>
              ))}
            </div>
            <div className="flex pt-2">
              <Hours />
              {columns.map((c) => (
                <div key={c.key} className="flex-1">
                  <Column day={c.day} list={c.list} blk={c.blk} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
