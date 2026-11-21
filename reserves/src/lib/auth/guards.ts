import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { MemberRole } from "@prisma/client";
import { cache } from "react";
import { db } from "../db";
import { getCurrentUser } from "./session";
import { accessState } from "./access";

export class ForbiddenError extends Error {
  constructor(msg = "forbidden") {
    super(msg);
  }
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireSuperAdmin() {
  const user = await requireUser();
  if (!user.isSuperAdmin) redirect("/panell");
  return user;
}

const ORG_COOKIE = "rsv_org";

/**
 * Context d'empresa per a cada petició del panell. L'organizationId SEMPRE
 * surt d'aquí (de la pertinença verificada de l'usuari), mai del formulari
 * ni de la URL. Totes les consultes de dades d'empresa han d'usar ctx.orgId.
 */
export const getOrgContext = cache(async () => {
  const user = await requireUser();
  const preferred = (await cookies()).get(ORG_COOKIE)?.value;
  const memberships = await db.organizationMember.findMany({
    where: { userId: user.id },
    include: { organization: { include: { subscription: true } } },
    orderBy: { createdAt: "asc" },
  });
  const m = memberships.find((x) => x.organizationId === preferred) ?? memberships[0];
  if (!m) return null;
  return {
    user,
    orgId: m.organizationId,
    org: m.organization,
    role: m.role,
    professionalId: m.professionalId,
    access: accessState(m.organization, m.organization.subscription),
    memberships,
  };
});

export type OrgContext = NonNullable<Awaited<ReturnType<typeof getOrgContext>>>;

export async function requireOrg(roles?: MemberRole[]): Promise<OrgContext> {
  const ctx = await getOrgContext();
  if (!ctx) {
    const user = await requireUser();
    redirect(user.isSuperAdmin ? "/admin" : "/registre");
  }
  if (roles && !roles.includes(ctx.role)) throw new ForbiddenError();
  return ctx;
}

export const ADMIN_ROLES: MemberRole[] = ["OWNER", "ADMIN"];
export const requireOrgAdmin = () => requireOrg(ADMIN_ROLES);
export const isOrgAdmin = (ctx: OrgContext) => ADMIN_ROLES.includes(ctx.role);

/** Filtre de cites segons el rol: un professional només veu les seves. */
export function appointmentScope(ctx: OrgContext) {
  return ctx.role === "PROFESSIONAL" ? { organizationId: ctx.orgId, professionalId: ctx.professionalId ?? "__none__" } : { organizationId: ctx.orgId };
}
