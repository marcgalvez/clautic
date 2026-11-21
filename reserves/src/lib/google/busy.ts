import type { GoogleCalendarConnection, Professional } from "@prisma/client";
import { db } from "../db";
import { logIntegrationError } from "../audit";
import type { Interval } from "../availability/intervals";
import { googleApi, GoogleApiError } from "./api";
import { getAccessToken } from "./connection";

const CACHE_TTL_MS = 5 * 60_000; // la reconciliació refresca cada 5 min com a molt
const STALE_FALLBACK_MS = 30 * 60_000; // si Google falla, acceptem dades de fins a 30 min

type ProWithConn = Professional & { googleConnection: GoogleCalendarConnection | null };

export type BusyResult = {
  busy: Map<string, Interval[]>; // professionalId → intervals ocupats a Google
  unavailable: Set<string>; // professionals dels quals no sabem l'ocupació (no es poden reservar)
};

function parse(list: { start: string; end: string }[]): Interval[] {
  return list.map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) }));
}

/**
 * Ocupació de Google Calendar dels professionals.
 *  - mode "cached": per mostrar disponibilitat (memòria cau invalidada per push).
 *  - mode "live": per confirmar una reserva (sempre consulta FreeBusy en directe).
 * Si no es pot saber l'ocupació d'un professional connectat, el marquem com a
 * no disponible: preferim no oferir una hora que arriscar un solapament.
 */
export async function getGoogleBusy(pros: ProWithConn[], range: { from: Date; to: Date }, mode: "cached" | "live"): Promise<BusyResult> {
  const busy = new Map<string, Interval[]>();
  const unavailable = new Set<string>();
  const connected = pros.filter((p) => p.googleConnection && p.googleCalendarId);
  const byConn = new Map<string, ProWithConn[]>();
  for (const p of connected) {
    if (p.googleConnection!.status === "REVOKED") continue; // revocada: ja no la llegim (avisem al panell)
    byConn.set(p.googleConnectionId!, [...(byConn.get(p.googleConnectionId!) ?? []), p]);
  }

  for (const [, list] of byConn) {
    const conn = list[0].googleConnection!;
    const calendarIds = [...new Set(list.map((p) => p.googleCalendarId!))];
    let data: Record<string, { start: string; end: string }[]> | null = null;
    const caches = await db.calendarBusyCache.findMany({ where: { connectionId: conn.id, calendarId: { in: calendarIds } } });
    const now = Date.now();
    const fresh = (maxAge: number) =>
      caches.length === calendarIds.length &&
      caches.every((c) => (maxAge === CACHE_TTL_MS ? !c.stale : true) && now - c.fetchedAt.getTime() < maxAge && c.rangeStart <= range.from && c.rangeEnd >= range.to);

    if (mode === "cached" && fresh(CACHE_TTL_MS)) {
      data = Object.fromEntries(caches.map((c) => [c.calendarId, c.busy as { start: string; end: string }[]]));
    } else {
      try {
        const token = await getAccessToken(conn);
        // En mode cached demanem una finestra àmplia per reaprofitar-la.
        const from = mode === "cached" ? new Date(Math.min(range.from.getTime(), now)) : range.from;
        const to = mode === "cached" ? new Date(Math.max(range.to.getTime(), now + 62 * 86400_000)) : range.to;
        data = await googleApi().freeBusy(token, calendarIds, from, to);
        if (mode === "cached") {
          for (const id of calendarIds) {
            await db.calendarBusyCache.upsert({
              where: { connectionId_calendarId: { connectionId: conn.id, calendarId: id } },
              create: { organizationId: conn.organizationId, connectionId: conn.id, calendarId: id, rangeStart: from, rangeEnd: to, busy: data[id], fetchedAt: new Date() },
              update: { rangeStart: from, rangeEnd: to, busy: data[id], fetchedAt: new Date(), stale: false },
            });
          }
        }
      } catch (e) {
        const err = e instanceof GoogleApiError ? e : new GoogleApiError(String(e), 0);
        await logIntegrationError({ organizationId: conn.organizationId, integration: "GOOGLE", operation: `freebusy_${mode}`, message: err.message, details: { status: err.status } });
        if (fresh(STALE_FALLBACK_MS)) data = Object.fromEntries(caches.map((c) => [c.calendarId, c.busy as { start: string; end: string }[]]));
      }
    }

    for (const p of list) {
      if (!data) unavailable.add(p.id);
      else busy.set(p.id, parse(data[p.googleCalendarId!] ?? []));
    }
  }
  return { busy, unavailable };
}

export async function invalidateBusyCache(connectionId: string, calendarId?: string) {
  await db.calendarBusyCache.updateMany({ where: { connectionId, ...(calendarId ? { calendarId } : {}) }, data: { stale: true } });
}
