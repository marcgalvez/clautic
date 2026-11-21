import { Prisma, type Appointment, type CalendarSyncJob } from "@prisma/client";
import { DateTime } from "luxon";
import { db } from "../db";
import { sha256 } from "../crypto";
import { logIntegrationError } from "../audit";
import { env } from "../env";
import { googleApi, GoogleApiError, type GoogleEvent } from "./api";
import { getAccessToken } from "./connection";
import { invalidateBusyCache } from "./busy";

const BACKOFF_MIN = [1, 5, 15, 60, 180, 360];

/** ID d'esdeveniment determinista (base32hex) → inserir dues vegades no duplica. */
export const googleEventIdFor = (appointmentId: string) => "rsv" + sha256(appointmentId).slice(0, 32);

export async function enqueueCalendarSync(tx: Prisma.TransactionClient, appt: Pick<Appointment, "id" | "organizationId">, action: "UPSERT" | "DELETE") {
  // Una tasca pendent per cita n'hi ha prou: la més nova guanya.
  await tx.calendarSyncJob.updateMany({ where: { appointmentId: appt.id, status: "PENDING" }, data: { status: "CANCELLED" } });
  return tx.calendarSyncJob.create({ data: { organizationId: appt.organizationId, appointmentId: appt.id, action } });
}

function buildEvent(a: Appointment & { customer: { firstName: string; lastName: string }; organization: { name: string } }, tz: string, address: string | null, cancelled = false): GoogleEvent {
  // Dades mínimes: nom i inicial del cognom. Sense telèfon ni correu.
  const who = `${a.customer.firstName} ${a.customer.lastName.slice(0, 1)}.`.trim();
  return {
    summary: `${cancelled ? "[CANCEL·LADA] " : ""}${a.serviceName} · ${who}`,
    description: `Reserva #${a.id.slice(-8).toUpperCase()} · ${a.organization.name}\nGestionada des de ${env().APP_NAME}. Modifica-la des del panell perquè es mantingui sincronitzada.`,
    location: address ?? undefined,
    start: { dateTime: DateTime.fromJSDate(a.startsAt).setZone(tz).toISO()!, timeZone: tz },
    end: { dateTime: DateTime.fromJSDate(a.endsAt).setZone(tz).toISO()!, timeZone: tz },
    transparency: cancelled ? "transparent" : "opaque",
    extendedProperties: { private: { rsvAppointmentId: a.id, rsvPlatform: "reserves" } },
    reminders: { useDefault: false },
  };
}

/** Processa una tasca de sincronització. Llança si cal reintentar. */
export async function runCalendarSyncJob(job: CalendarSyncJob): Promise<void> {
  const a = await db.appointment.findUnique({
    where: { id: job.appointmentId },
    include: { customer: true, organization: { include: { settings: true } }, professional: { include: { googleConnection: true } } },
  });
  if (!a) return;
  const settings = a.organization.settings!;
  const pro = a.professional;
  const conn = pro.googleConnection;
  const targetCal = conn && conn.status !== "REVOKED" ? pro.googleCalendarId : null;
  const wantDelete = job.action === "DELETE" || a.status === "CANCELLED";

  // Si l'esdeveniment és en un altre calendari (canvi de professional), primer l'esborrem d'allà.
  if (a.googleEventId && a.googleCalendarId && a.googleCalendarId !== targetCal) {
    // L'empresa sol tenir 1-2 connexions: provem d'esborrar-lo amb cadascuna (404 s'ignora).
    const conns = await db.googleCalendarConnection.findMany({ where: { organizationId: a.organizationId, status: { not: "REVOKED" } } });
    for (const c of conns) {
      const tok = await getAccessToken(c);
      await googleApi().deleteEvent(tok, a.googleCalendarId, a.googleEventId).catch((e) => {
        if (!(e instanceof GoogleApiError && e.status === 403)) throw e;
      });
    }
    await db.appointment.update({ where: { id: a.id }, data: { googleEventId: null, googleCalendarId: null } });
    a.googleEventId = null;
  }

  if (!targetCal || !conn) {
    await db.appointment.update({ where: { id: a.id }, data: { googleSyncStatus: "NOT_APPLICABLE", googleSyncError: null } });
    return;
  }

  const token = await getAccessToken(conn);
  const api = googleApi();
  const eventId = a.googleEventId ?? googleEventIdFor(a.id);

  if (wantDelete) {
    if (settings.googleCancelMode === "DELETE") await api.deleteEvent(token, targetCal, eventId);
    else
      await api.updateEvent(token, targetCal, eventId, buildEvent(a, settings.timezone, settings.address, true)).catch((e) => {
        if (!(e instanceof GoogleApiError && e.status === 404)) throw e;
      });
  } else {
    const ev = buildEvent(a, settings.timezone, settings.address);
    try {
      await api.updateEvent(token, targetCal, eventId, ev);
    } catch (e) {
      if (!(e instanceof GoogleApiError && (e.status === 404 || e.status === 410))) throw e;
      try {
        await api.insertEvent(token, targetCal, { ...ev, id: eventId });
      } catch (e2) {
        // 409: ja existeix (inserció anterior que no vam poder registrar) → actualitzem.
        if (e2 instanceof GoogleApiError && e2.status === 409) await api.updateEvent(token, targetCal, eventId, ev);
        else throw e2;
      }
    }
  }

  await db.$transaction([
    db.appointment.update({
      where: { id: a.id },
      data: { googleSyncStatus: "SYNCED", googleSyncError: null, googleSyncedAt: new Date(), googleEventId: eventId, googleCalendarId: targetCal },
    }),
    db.appointmentEvent.create({ data: { organizationId: a.organizationId, appointmentId: a.id, type: "GOOGLE_SYNCED", actorType: "SYSTEM", data: { action: wantDelete ? "DELETE" : "UPSERT" } } }),
  ]);
  await invalidateBusyCache(conn.id, targetCal);
}

/** Reclama i processa tasques pendents (segur amb diversos treballadors: SKIP LOCKED). */
export async function processCalendarSyncJobs(limit = 20, onlyJobId?: string): Promise<{ done: number; failed: number }> {
  const claimed = await db.$queryRaw<CalendarSyncJob[]>`
    UPDATE "CalendarSyncJob" SET "status" = 'PROCESSING', "lockedAt" = now(), "attempts" = "attempts" + 1, "updatedAt" = now()
    WHERE "id" IN (
      SELECT "id" FROM "CalendarSyncJob"
      WHERE "status" = 'PENDING' AND "runAt" <= now() ${onlyJobId ? Prisma.sql`AND "id" = ${onlyJobId}` : Prisma.empty}
      ORDER BY "runAt" LIMIT ${limit} FOR UPDATE SKIP LOCKED)
    RETURNING *`;
  let done = 0,
    failed = 0;
  for (const job of claimed) {
    try {
      await runCalendarSyncJob(job);
      await db.calendarSyncJob.update({ where: { id: job.id }, data: { status: "DONE", lockedAt: null, lastError: null } });
      done++;
    } catch (e) {
      failed++;
      const err = e instanceof GoogleApiError ? e : new GoogleApiError((e as Error).message ?? String(e), 0);
      const final = job.attempts >= job.maxAttempts || err.revoked;
      const delay = BACKOFF_MIN[Math.min(job.attempts - 1, BACKOFF_MIN.length - 1)];
      await db.calendarSyncJob.update({
        where: { id: job.id },
        data: { status: final ? "FAILED" : "PENDING", lockedAt: null, lastError: err.message, runAt: new Date(Date.now() + delay * 60_000) },
      });
      // No marquem mai com a sincronitzada una cita si Google ha fallat.
      await db.appointment.update({ where: { id: job.appointmentId }, data: { googleSyncStatus: "FAILED", googleSyncError: err.message.slice(0, 500) } });
      await db.appointmentEvent.create({ data: { organizationId: job.organizationId, appointmentId: job.appointmentId, type: "GOOGLE_SYNC_FAILED", actorType: "SYSTEM", data: { error: err.message, attempt: job.attempts, final } } });
      await logIntegrationError({ organizationId: job.organizationId, integration: "GOOGLE", operation: `sync_${job.action.toLowerCase()}`, message: err.message, details: { appointmentId: job.appointmentId, attempt: job.attempts, final, status: err.status } });
    }
  }
  return { done, failed };
}


/** Quan canvia el calendari d'un professional, les cites futures es tornen a sincronitzar. */
export async function resyncFutureAppointments(orgId: string, professionalId: string) {
  const list = await db.appointment.findMany({ where: { organizationId: orgId, professionalId, status: { in: ["PENDING", "CONFIRMED"] }, startsAt: { gt: new Date() } }, select: { id: true, organizationId: true } });
  for (const a of list) {
    await db.$transaction(async (tx) => {
      await tx.appointment.update({ where: { id: a.id }, data: { googleSyncStatus: "PENDING" } });
      await enqueueCalendarSync(tx, a, "UPSERT");
    });
  }
  return list.length;
}
