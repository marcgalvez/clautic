import { DateTime } from "luxon";
import { z } from "zod";
import { getAvailability } from "@/lib/availability/service";
import { rateLimit } from "@/lib/rate-limit";
import { ipOf, json } from "@/lib/public/http";
import { publicOrg } from "@/lib/public/org";

const q = z.object({
  serviceId: z.string().min(1).max(40),
  professionalId: z.string().max(40).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(await rateLimit(`avail:${ipOf(req)}`, 120, 60))) return json({ error: "RATE_LIMIT" }, 429);
  const parsed = q.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return json({ error: "INVALID" }, 400);
  const p = await publicOrg(slug);
  if (!p?.active) return json({ error: "NOT_FOUND" }, 404);
  const tz = p.settings.timezone;
  const today = DateTime.now().setZone(tz).toISODate()!;
  let from = parsed.data.from < today ? today : parsed.data.from;
  let to = parsed.data.to;
  if (DateTime.fromISO(to).diff(DateTime.fromISO(from), "days").days > 42) to = DateTime.fromISO(from).plus({ days: 42 }).toISODate()!;
  if (to < from) return json({ days: [] });

  const r = await getAvailability({ orgId: p.org.id, serviceId: parsed.data.serviceId, professionalId: parsed.data.professionalId || null, fromDate: from, toDate: to, mode: "cached" });
  if (!r) return json({ error: "NOT_FOUND" }, 404);
  return json({
    days: r.days.map((d) => ({
      date: d.date,
      slots: d.slots.map((s) => ({ start: s.start, time: DateTime.fromISO(s.start).setZone(tz).toFormat("HH:mm") })),
    })),
  });
}
