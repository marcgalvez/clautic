import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { getT } from "@/lib/i18n";
import { fmtDateTime } from "@/lib/format";
import { maskPhone } from "@/lib/phone";
import { Badge, PageHeader, statusTone } from "@/components/ui";

export default async function AdminReminders() {
  const user = await requireSuperAdmin();
  const { t, locale } = await getT(user.locale);
  const msgs = await db.whatsAppMessage.findMany({ include: { organization: true }, orderBy: { createdAt: "desc" }, take: 200 });
  return (
    <>
      <PageHeader title={t.admin.nav.reminders} />
      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead><tr><th>{t.common.date}</th><th>{t.admin.orgs}</th><th>{t.common.phone}</th><th>Template</th><th>{t.common.status}</th></tr></thead>
          <tbody>
            {msgs.map((m) => (
              <tr key={m.id}>
                <td className="whitespace-nowrap">{fmtDateTime(m.createdAt, "Europe/Madrid", locale)}</td>
                <td>{m.organization.name}</td>
                <td className="whitespace-nowrap">{maskPhone(m.toPhone)}</td>
                <td className="text-xs">{m.templateName} ({m.language}) · {m.provider}</td>
                <td><Badge tone={statusTone[m.status]}>{m.status}</Badge>{m.errorMessage && <div className="mt-1 max-w-xs text-xs text-red-700">{m.errorCode}: {m.errorMessage}</div>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
