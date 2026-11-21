import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { getT } from "@/lib/i18n";
import { fmtDateTime } from "@/lib/format";
import { Badge, Empty, PageHeader } from "@/components/ui";

export default async function AdminErrors({ searchParams }: { searchParams: Promise<{ integration?: string }> }) {
  const sp = await searchParams;
  const user = await requireSuperAdmin();
  const { t, locale } = await getT(user.locale);
  const integration = sp.integration === "GOOGLE" || sp.integration === "WHATSAPP" ? sp.integration : undefined;
  const errors = await db.integrationErrorLog.findMany({ where: integration ? { integration } : {}, include: { organization: true }, orderBy: { createdAt: "desc" }, take: 200 });
  return (
    <>
      <PageHeader title={t.admin.nav.errors} actions={<div className="flex gap-2">{["", "GOOGLE", "WHATSAPP"].map((i) => <a key={i} href={`/admin/errors${i ? `?integration=${i}` : ""}`} className="btn-secondary">{i || t.common.all}</a>)}</div>} />
      {!errors.length ? (
        <Empty>—</Empty>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="table">
            <thead><tr><th>{t.common.date}</th><th>{t.admin.orgs}</th><th>Integració</th><th>Operació</th><th>Missatge</th></tr></thead>
            <tbody>
              {errors.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap">{fmtDateTime(e.createdAt, "Europe/Madrid", locale)}</td>
                  <td>{e.organization?.name ?? "—"}</td>
                  <td><Badge tone={e.integration === "GOOGLE" ? "blue" : "green"}>{e.integration}</Badge></td>
                  <td className="font-mono text-xs">{e.operation}</td>
                  <td className="max-w-md text-xs">{e.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
