import { DateTime } from "luxon";
import { z } from "zod";
import { createAppointment } from "@/lib/booking/service";
import { rateLimit } from "@/lib/rate-limit";
import { ipOf, json, sameOrigin } from "@/lib/public/http";
import { publicOrg } from "@/lib/public/org";
import { normalizePhone } from "@/lib/phone";
import { env } from "@/lib/env";
import { dict, isLocale } from "@/lib/i18n";
import { db } from "@/lib/db";
import { ucfirst } from "@/lib/format";

const body = z.object({
  serviceId: z.string().min(1).max(40),
  professionalId: z.string().max(40).nullable(),
  start: z.string().datetime(),
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(80),
  phonePrefix: z.string().regex(/^\+\d{1,4}$/),
  phone: z.string().trim().min(6).max(25),
  email: z.string().trim().email().max(120).optional().or(z.literal("")),
  whatsappConsent: z.boolean(),
  acceptPrivacy: z.literal(true),
  locale: z.string(),
  website: z.string().max(0).optional(), // camp trampa per a bots
});

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!sameOrigin(req)) return json({ error: "FORBIDDEN" }, 403);
  const ip = ipOf(req);
  if (!(await rateLimit(`book:${ip}`, 10, 600))) return json({ error: "RATE_LIMIT" }, 429);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "INVALID", fields: parsed.error.issues.map((i) => i.path.join(".")) }, 400);
  const d = parsed.data;
  const phone = normalizePhone(d.phone, d.phonePrefix);
  if (!phone) return json({ error: "INVALID", fields: ["phone"] }, 400);
  if (!(await rateLimit(`book-phone:${phone}`, 5, 3600))) return json({ error: "RATE_LIMIT" }, 429);

  const p = await publicOrg(slug);
  if (!p?.active) return json({ error: "ORG_INACTIVE" }, 404);
  if (p.settings.emailRequirement === "REQUIRED" && !d.email) return json({ error: "INVALID", fields: ["email"] }, 400);
  const locale = isLocale(d.locale) ? d.locale : "ca";

  const r = await createAppointment({
    orgId: p.org.id,
    serviceId: d.serviceId,
    professionalId: d.professionalId,
    startsAt: new Date(d.start),
    customer: { firstName: d.firstName, lastName: d.lastName, phoneE164: phone, email: p.settings.emailRequirement === "HIDDEN" ? null : d.email || null, locale },
    whatsappConsent: d.whatsappConsent,
    consentText: dict(locale).booking.whatsappConsent, // text exacte que ha vist el client
    source: "PUBLIC",
    actor: { type: "CUSTOMER" },
    ip,
    userAgent: req.headers.get("user-agent"),
  });
  if (!r.ok) return json({ error: r.error }, r.error === "SLOT_TAKEN" || r.error === "NOT_AVAILABLE" ? 409 : 400);

  const a = await db.appointment.findUniqueOrThrow({ where: { id: r.value.id }, include: { professional: true, reminderJobs: true } });
  const tz = p.settings.timezone;
  const start = DateTime.fromJSDate(a.startsAt).setZone(tz).setLocale(locale);
  return json({
    ok: true,
    manageUrl: `${env().APP_URL}/cita/${r.value.manageToken}`,
    appointment: {
      center: p.org.name,
      address: p.settings.address,
      service: a.serviceName,
      professional: a.professional.name,
      date: ucfirst(start.toFormat("cccc d 'de' LLLL yyyy")),
      time: start.toFormat("HH:mm"),
      duration: a.durationMinutes,
      reminder: a.reminderJobs.some((j) => j.status === "PENDING"),
    },
  });
}
