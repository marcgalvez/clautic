import Link from "next/link";
import { db } from "@/lib/db";
import { requireOrgAdmin } from "@/lib/auth/guards";
import { getT } from "@/lib/i18n";
import { Badge, PageHeader } from "@/components/ui";

export default async function Professionals() {
  const ctx = await requireOrgAdmin();
  const { t } = await getT(ctx.user.locale);
  const pros = await db.professional.findMany({ where: { organizationId: ctx.orgId }, include: { services: true, member: { include: { user: true } }, googleConnection: true }, orderBy: [{ active: "desc" }, { sortOrder: "asc" }] });
  return (
    <>
      <PageHeader title={t.dash.pros.title} actions={<Link href="/panell/professionals/nou" className="btn-primary">+ {t.dash.pros.new}</Link>} />
      <ul className="grid gap-3 md:grid-cols-2">
        {pros.map((p) => (
          <li key={p.id}>
            <Link href={`/panell/professionals/${p.id}`} className={`card flex items-center gap-4 hover:ring-2 hover:ring-accent/30 ${p.active ? "" : "opacity-60"}`}>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-semibold text-white" style={{ background: p.color }} aria-hidden>
                {p.name.slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{p.name}</div>
                <div className="text-sm text-stone-600">
                  {p.services.length} {t.dash.nav.services.toLowerCase()}
                  {p.member && ` · ${p.member.user.email}`}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {p.googleCalendarId ? <Badge tone={p.googleConnection?.status === "ACTIVE" ? "green" : "red"}>Google</Badge> : <Badge>{t.dash.pros.noCalendar}</Badge>}
                {!p.active && <Badge>{t.common.inactive}</Badge>}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
