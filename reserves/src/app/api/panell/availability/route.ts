import { DateTime } from "luxon";
import { getOrgContext, isOrgAdmin } from "@/lib/auth/guards";
import { getAvailability } from "@/lib/availability/service";
import { db } from "@/lib/db";
import { json } from "@/lib/public/http";

export async function GET(req: Request) {
  const ctx = await getOrgContext();
  if (!ctx || !isOrgAdmin(ctx)) return json({ error: "UNAUTHORIZED" }, 401);
  const sp = new URL(req.url).searchParams;
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? from;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return json({ days: [] });
  const s = await db.organizationSettings.findUniqueOrThrow({ where: { organizationId: ctx.orgId } });
  const today = DateTime.now().setZone(s.timezone).toISODate()!;
  const r = await getAvailability({
    orgId: ctx.orgId, // sempre el de la sessió
    serviceId: sp.get("serviceId") ?? "",
    professionalId: sp.get("professionalId") || null,
    fromDate: from < today ? today : from,
    toDate: to,
    mode: "cached",
    excludeAppointmentId: sp.get("exclude") || undefined,
    ignoreRules: sp.get("ignoreRules") === "1",
  });
  return json({ days: (r?.days ?? []).map((d) => ({ date: d.date, slots: d.slots.map((x) => ({ start: x.start, time: DateTime.fromISO(x.start).setZone(s.timezone).toFormat("HH:mm") })) })) });
}
