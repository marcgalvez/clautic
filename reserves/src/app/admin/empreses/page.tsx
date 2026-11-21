import Link from "next/link";
import type { OrganizationStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { getT } from "@/lib/i18n";
import { accessState } from "@/lib/auth/access";
import { fmtDateTime } from "@/lib/format";
import { Badge, Empty, PageHeader, statusTone } from "@/components/ui";

const TABS: (OrganizationStatus | "ALL")[] = ["PENDING_APPROVAL", "ACTIVE", "SUSPENDED", "ALL"];

export default async function Orgs({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const sp = await searchParams;
  const user = await requireSuperAdmin();
  const { t, locale } = await getT(user.locale);
  const ta = t.admin;
  const status = TABS.find((x) => x === sp.status) ?? "ALL";
  const q = (sp.q ?? "").trim().slice(0, 60);
  const orgs = await db.organization.findMany({
    where: { ...(status !== "ALL" ? { status } : {}), ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { slug: { contains: q.toLowerCase() } }, { contactEmail: { contains: q, mode: "insensitive" } }] } : {}) },
    include: { subscription: true, _count: { select: { appointments: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <>
      <PageHeader title={ta.orgs} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TABS.map((s) => (
          <Link key={s} href={`/admin/empreses?status=${s}`} className={`rounded-full px-3 py-1.5 text-sm ring-1 ${s === status ? "bg-stone-900 text-white ring-stone-900" : "bg-white ring-stone-300"}`}>
            {s === "ALL" ? t.common.all : ta.st[s]}
          </Link>
        ))}
        <form className="ml-auto flex gap-2" role="search">
          <input type="hidden" name="status" value={status} />
          <label htmlFor="q" className="sr-only">{t.common.search}</label>
          <input id="q" name="q" defaultValue={q} placeholder={t.common.search} className="input" />
        </form>
      </div>
      {!orgs.length ? (
        <Empty>—</Empty>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="table">
            <thead><tr><th>{t.common.name}</th><th>{ta.access}</th><th>{ta.plan}</th><th>{ta.purchasedAt}</th><th>{ta.endsAt}</th><th>{ta.appointments}</th><th>{ta.registered}</th></tr></thead>
            <tbody>
              {orgs.map((o) => {
                const st = accessState(o, o.subscription);
                return (
                  <tr key={o.id}>
                    <td><Link href={`/admin/empreses/${o.id}`} className="font-medium underline">{o.name}</Link><div className="text-xs text-stone-500">{o.contactEmail}</div></td>
                    <td><Badge tone={statusTone[st]}>{ta.st[st]}</Badge></td>
                    <td>{o.subscription?.plan ?? "—"}</td>
                    <td className="whitespace-nowrap">{o.subscription?.purchasedAt ? fmtDateTime(o.subscription.purchasedAt, "Europe/Madrid", locale).split(" · ")[0] : "—"}</td>
                    <td className="whitespace-nowrap">{o.subscription?.endsAt ? fmtDateTime(o.subscription.endsAt, "Europe/Madrid", locale).split(" · ")[0] : "∞"}</td>
                    <td>{o._count.appointments}</td>
                    <td className="whitespace-nowrap">{fmtDateTime(o.createdAt, "Europe/Madrid", locale)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
