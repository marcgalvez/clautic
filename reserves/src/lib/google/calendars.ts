import { db } from "../db";
import { googleApi } from "./api";
import { getAccessToken } from "./connection";
import { logIntegrationError } from "../audit";

/** Calendaris on l'empresa pot escriure, per triar-los al panell ("connexió|calendari"). */
export async function listCalendarsFor(orgId: string): Promise<{ value: string; label: string }[]> {
  const conns = await db.googleCalendarConnection.findMany({ where: { organizationId: orgId, status: { not: "REVOKED" } } });
  const out: { value: string; label: string }[] = [];
  for (const c of conns) {
    try {
      const cals = await googleApi().listCalendars(await getAccessToken(c));
      for (const cal of cals) out.push({ value: `${c.id}|${cal.id}`, label: `${cal.summary}${cal.primary ? " ★" : ""} — ${c.googleEmail}` });
    } catch (e) {
      await logIntegrationError({ organizationId: orgId, integration: "GOOGLE", operation: "calendar_list", message: (e as Error).message });
    }
  }
  return out;
}
