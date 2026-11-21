import { DateTime } from "luxon";
import { getAvailability } from "@/lib/availability/service";
import { findByManageToken } from "@/lib/booking/service";
import { rateLimit } from "@/lib/rate-limit";
import { ipOf, json } from "@/lib/public/http";

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!(await rateLimit(`avail:${ipOf(req)}`, 120, 60))) return json({ error: "RATE_LIMIT" }, 429);
  const a = await findByManageToken((await params).token);
  if (!a?.organization.settings?.allowCustomerReschedule) return json({ error: "NOT_FOUND" }, 404);
  const sp = new URL(req.url).searchParams;
  const tz = a.organization.settings.timezone;
  const today = DateTime.now().setZone(tz).toISODate()!;
  const from = (sp.get("from") ?? today) < today ? today : sp.get("from")!;
  const to = sp.get("to") ?? from;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) return json({ days: [] });
  const r = await getAvailability({ orgId: a.organizationId, serviceId: a.serviceId, professionalId: a.professionalId, fromDate: from, toDate: to, mode: "cached", excludeAppointmentId: a.id });
  return json({ days: (r?.days ?? []).map((d) => ({ date: d.date, slots: d.slots.map((s) => ({ start: s.start, time: DateTime.fromISO(s.start).setZone(tz).toFormat("HH:mm") })) })) });
}
