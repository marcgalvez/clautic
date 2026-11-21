import { db } from "@/lib/db";
import { requireOrgAdmin } from "@/lib/auth/guards";
import { getT } from "@/lib/i18n";
import { Empty, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { anonymizeCustomer } from "../actions";

export default async function Customers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const ctx = await requireOrgAdmin();
  const { t } = await getT(ctx.user.locale);
  const tc = t.dash.customers;
  const term = q.trim().slice(0, 60);
  const customers = await db.customer.findMany({
    where: { organizationId: ctx.orgId, NOT: { phoneE164: { startsWith: "deleted:" } }, ...(term ? { OR: [{ firstName: { contains: term, mode: "insensitive" } }, { lastName: { contains: term, mode: "insensitive" } }, { phoneE164: { contains: term.replace(/\s/g, "") } }] } : {}) },
    include: { _count: { select: { appointments: true } } },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return (
    <>
      <PageHeader title={tc.title} />
      <form className="mb-4 flex max-w-md gap-2" role="search">
        <label htmlFor="q" className="sr-only">{t.common.search}</label>
        <input id="q" name="q" defaultValue={term} placeholder={t.common.search} className="input" />
        <button className="btn-secondary">{t.common.search}</button>
      </form>
      {!customers.length ? (
        <Empty>{tc.empty}</Empty>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="table">
            <thead><tr><th>{t.common.name}</th><th>{t.common.phone}</th><th>{tc.appointments}</th><th>{tc.consent}</th><th>{t.common.actions}</th></tr></thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td>{c.firstName} {c.lastName}{c.email && <div className="text-xs text-stone-500">{c.email}</div>}</td>
                  <td className="whitespace-nowrap">{c.phoneE164}</td>
                  <td>{c._count.appointments}</td>
                  <td>{c.whatsappConsent ? "✔" : "—"}</td>
                  <td className="flex flex-wrap gap-2">
                    <a className="btn-ghost px-2" href={`/api/panell/export?customer=${c.id}`}>⬇ {tc.export}</a>
                    <form action={anonymizeCustomer}><input type="hidden" name="id" value={c.id} /><SubmitButton className="btn-ghost px-2 text-red-700" confirm={tc.anonymizeConfirm}>{tc.anonymize}</SubmitButton></form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
