import { z } from "zod";
import { cancelAppointment, customerCanChange, findByManageToken, rescheduleAppointment } from "@/lib/booking/service";
import { accessState } from "@/lib/auth/access";
import { rateLimit } from "@/lib/rate-limit";
import { ipOf, json, sameOrigin } from "@/lib/public/http";

const body = z.discriminatedUnion("action", [z.object({ action: z.literal("cancel") }), z.object({ action: z.literal("reschedule"), start: z.string().datetime() })]);

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!sameOrigin(req)) return json({ error: "FORBIDDEN" }, 403);
  if (!(await rateLimit(`manage:${ipOf(req)}`, 20, 600))) return json({ error: "RATE_LIMIT" }, 429);
  const a = await findByManageToken((await params).token);
  if (!a) return json({ error: "NOT_FOUND" }, 404);
  const s = a.organization.settings!;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "INVALID" }, 400);
  if (!customerCanChange(a, s) || accessState(a.organization, a.organization.subscription) !== "ACTIVE") return json({ error: "NOT_ALLOWED" }, 403);

  if (parsed.data.action === "cancel") {
    if (!s.allowCustomerCancel) return json({ error: "NOT_ALLOWED" }, 403);
    const r = await cancelAppointment({ orgId: a.organizationId, appointmentId: a.id, actor: { type: "CUSTOMER" }, reason: "Cancel·lada pel client" });
    return r.ok ? json({ ok: true }) : json({ error: r.error }, 400);
  }
  if (!s.allowCustomerReschedule) return json({ error: "NOT_ALLOWED" }, 403);
  const r = await rescheduleAppointment({ orgId: a.organizationId, appointmentId: a.id, startsAt: new Date(parsed.data.start), actor: { type: "CUSTOMER" } });
  return r.ok ? json({ ok: true }) : json({ error: r.error }, r.error === "NOT_AVAILABLE" || r.error === "SLOT_TAKEN" ? 409 : 400);
}
