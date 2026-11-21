import { db } from "../db";
import { accessState } from "../auth/access";

export async function publicOrg(slug: string) {
  const org = await db.organization.findUnique({ where: { slug }, include: { settings: true, subscription: true } });
  if (!org?.settings) return null;
  return { org, settings: org.settings, active: accessState(org, org.subscription) === "ACTIVE" };
}
