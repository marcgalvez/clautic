import { requireSuperAdmin } from "@/lib/auth/guards";
import { getT } from "@/lib/i18n";
import { Shell } from "@/components/Shell";
import { db } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSuperAdmin();
  const { t, locale } = await getT(user.locale);
  const n = t.admin.nav;
  const pending = await db.organization.count({ where: { status: "PENDING_APPROVAL" } });
  const hasOrg = await db.organizationMember.count({ where: { userId: user.id } });
  return (
    <Shell
      brand={t.admin.title}
      subtitle={t.common.appName}
      locale={locale}
      logoutLabel={t.common.logout}
      userName={user.email}
      accent="#1c1917"
      items={[
        { href: "/admin", label: n.overview, icon: "📊" },
        { href: "/admin/empreses", label: pending ? `${n.orgs} (${pending})` : n.orgs, icon: "🏢" },
        { href: "/admin/recordatoris", label: n.reminders, icon: "💬" },
        { href: "/admin/errors", label: n.errors, icon: "⚠️" },
        { href: "/admin/plataforma", label: n.platform, icon: "⚙️" },
      ]}
      extra={hasOrg ? <Link href="/panell" className="text-sm underline">← {t.dash.nav.home}</Link> : null}
    >
      {children}
    </Shell>
  );
}
