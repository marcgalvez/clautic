import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import type { GoogleApi, GoogleEvent } from "@/lib/google/api";
import { GoogleApiError } from "@/lib/google/api";

export async function resetDb() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`;
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(",")} CASCADE`);
}

export async function makeOrg(slug: string, opts: { status?: "ACTIVE" | "PENDING_APPROVAL" | "SUSPENDED"; pros?: number } = {}) {
  const org = await db.organization.create({
    data: {
      slug,
      name: `Centre ${slug}`,
      status: opts.status ?? "ACTIVE",
      contactEmail: `${slug}@example.com`,
      settings: { create: { minNoticeMinutes: 0, slotStepMinutes: 30 } },
      subscription: { create: { status: "ACTIVE" } },
      businessHours: { create: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, startMinute: 9 * 60, endMinute: 19 * 60 })) },
    },
  });
  const service = await db.service.create({ data: { organizationId: org.id, name: "Tall de cabell", durationMinutes: 30, priceCents: 2000 } });
  const long = await db.service.create({ data: { organizationId: org.id, name: "Tint", durationMinutes: 90 } });
  const pros = [];
  for (let i = 0; i < (opts.pros ?? 1); i++) {
    const p = await db.professional.create({ data: { organizationId: org.id, name: `Pro ${i + 1}`, sortOrder: i } });
    await db.professionalService.createMany({ data: [service, long].map((s) => ({ organizationId: org.id, professionalId: p.id, serviceId: s.id })) });
    pros.push(p);
  }
  return { org, service, long, pros };
}

export const customer = (phone = "+34600111222") => ({ firstName: "Laura", lastName: "Puig", phoneE164: phone, email: null, locale: "ca" });

/** Data futura en hora de Madrid (novembre = UTC+1). */
export const at = (isoUtc: string) => new Date(isoUtc);

export class FakeGoogle implements GoogleApi {
  events = new Map<string, GoogleEvent & { calendarId: string }>();
  busy: { start: string; end: string }[] = [];
  failNext = 0;
  calls: string[] = [];
  private maybeFail(op: string) {
    this.calls.push(op);
    if (this.failNext > 0) {
      this.failNext--;
      throw new GoogleApiError("Backend Error", 503);
    }
  }
  async exchangeCode() {
    return { accessToken: "a", refreshToken: "r", expiresAt: new Date(Date.now() + 3600_000), scope: "" };
  }
  async refresh() {
    return { accessToken: "a2", expiresAt: new Date(Date.now() + 3600_000), scope: "" };
  }
  async revoke() {}
  async listCalendars() {
    return [{ id: "primary", summary: "Agenda", primary: true, accessRole: "owner" }];
  }
  async freeBusy(_t: string, ids: string[]) {
    this.maybeFail("freeBusy");
    return Object.fromEntries(ids.map((id) => [id, this.busy]));
  }
  async insertEvent(_t: string, calendarId: string, ev: GoogleEvent) {
    this.maybeFail("insert");
    if (this.events.has(ev.id!)) throw new GoogleApiError("duplicate", 409);
    this.events.set(ev.id!, { ...ev, calendarId });
    return { id: ev.id! };
  }
  async updateEvent(_t: string, calendarId: string, id: string, ev: GoogleEvent) {
    this.maybeFail("update");
    if (!this.events.has(id)) throw new GoogleApiError("not found", 404);
    this.events.set(id, { ...ev, id, calendarId });
    return { id };
  }
  async deleteEvent(_t: string, _c: string, id: string) {
    this.maybeFail("delete");
    this.events.delete(id);
  }
  async watchEvents() {
    return { resourceId: "res", expiration: new Date(Date.now() + 7 * 86400_000) };
  }
  async stopChannel() {}
}

export async function connectGoogle(orgId: string, professionalId: string) {
  const conn = await db.googleCalendarConnection.create({
    data: { organizationId: orgId, googleEmail: "pro@gmail.com", googleSub: "sub-" + orgId, accessTokenEnc: encrypt("a"), refreshTokenEnc: encrypt("r"), accessExpiresAt: new Date(Date.now() + 3600_000), scopes: "" },
  });
  await db.professional.update({ where: { id: professionalId }, data: { googleConnectionId: conn.id, googleCalendarId: "primary" } });
  return conn;
}
