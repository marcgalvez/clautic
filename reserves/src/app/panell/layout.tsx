import { requireOrg, isOrgAdmin } from "@/lib/auth/guards";
import { getT } from "@/lib/i18n";
import { Shell } from "@/components/Shell";
import { Alert } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrg();
  const { t, locale } = await getT(ctx.user.locale);
  const n = t.dash.nav;
  const admin = isOrgAdmin(ctx);
  const items = [
    { href: "/panell", label: n.home, icon: "🏠" },
    { href: "/panell/calendari", label: n.calendar, icon: "📅" },
    ...(admin
      ? [
          { href: "/panell/serveis", label: n.services, icon: "✂️" },
          { href: "/panell/professionals", label: n.professionals, icon: "👥" },
        ]
      : []),
    { href: "/panell/bloquejos", label: n.blocks, icon: "⛔" },
    ...(admin
      ? [
          { href: "/panell/clients", label: n.customers, icon: "🙋" },
          { href: "/panell/recordatoris", label: n.reminders, icon: "💬" },
          { href: "/panell/integracions", label: n.integrations, icon: "🔌" },
          { href: "/panell/configuracio", label: n.settings, icon: "⚙️" },
        ]
      : []),
    ...(ctx.user.isSuperAdmin ? [{ href: "/admin", label: n.admin, icon: "🛡️" }] : []),
  ];
  const settings = await import("@/lib/db").then(({ db }) => db.organizationSettings.findUnique({ where: { organizationId: ctx.orgId }, select: { accentColor: true } }));
  const blocked = ctx.access === "SUSPENDED" || ctx.access === "EXPIRED";
  return (
    <Shell
      brand={ctx.org.name}
      subtitle={t.common.appName}
      items={blocked ? items.slice(0, 1) : items}
      locale={locale}
      logoutLabel={t.common.logout}
      userName={ctx.user.name}
      accent={settings?.accentColor}
      banner={ctx.access !== "ACTIVE" ? <Alert tone={blocked ? "red" : "amber"}>{t.dash.access[ctx.access]}</Alert> : null}
    >
      {blocked && !ctx.user.isSuperAdmin ? null : children}
    </Shell>
  );
}
