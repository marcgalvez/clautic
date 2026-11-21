import Link from "next/link";
import type { Appointment, Customer, Professional } from "@prisma/client";
import { Badge, Empty, statusTone } from "./ui";
import { fmtTime, dt } from "@/lib/format";
import type { Dict } from "@/lib/i18n/ca";

type A = Appointment & { customer: Customer; professional: Professional };

export function ApptList({ items, tz, t, locale, showDate = false }: { items: A[]; tz: string; t: Dict; locale: string; showDate?: boolean }) {
  if (!items.length) return <Empty>{t.dash.home.noAppointments}</Empty>;
  return (
    <ul className="divide-y divide-stone-100">
      {items.map((a) => (
        <li key={a.id}>
          <Link href={`/panell/cites/${a.id}`} className="flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-stone-50">
            <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ background: a.professional.color }} aria-hidden />
            <div className="w-16 shrink-0 text-sm font-semibold tabular-nums">
              {showDate && <div className="text-xs font-normal text-stone-500">{dt(a.startsAt, tz, locale).toFormat("ccc d")}</div>}
              {fmtTime(a.startsAt, tz)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">
                {a.customer.firstName} {a.customer.lastName}
              </div>
              <div className="truncate text-xs text-stone-500">
                {a.serviceName} · {a.professional.name}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge tone={statusTone[a.status]}>{t.dash.appt.st[a.status]}</Badge>
              {a.googleSyncStatus === "FAILED" && <Badge tone="red">Google ✕</Badge>}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
