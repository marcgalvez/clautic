import { db } from "../db";
import { env } from "../env";
import { randomToken, safeEqual, sha256 } from "../crypto";
import { logIntegrationError } from "../audit";
import { googleApi, GoogleApiError } from "./api";
import { getAccessToken } from "./connection";
import { invalidateBusyCache } from "./busy";

const TTL_SECONDS = 7 * 86400;

/**
 * Manté canals de notificació push (events.watch) per a cada calendari en ús.
 * Google només envia push a URLs HTTPS públiques: en local s'omet i n'hi ha prou
 * amb la reconciliació periòdica (TTL de la memòria cau).
 */
export async function ensureWatches(): Promise<{ created: number; skipped: string | null }> {
  const base = env().APP_URL;
  if (!base.startsWith("https://")) return { created: 0, skipped: "APP_URL no és HTTPS" };
  const pros = await db.professional.findMany({
    where: { active: true, googleCalendarId: { not: null }, googleConnection: { status: { not: "REVOKED" } } },
    include: { googleConnection: { include: { watches: true } } },
  });
  const seen = new Set<string>();
  let created = 0;
  for (const p of pros) {
    const conn = p.googleConnection!;
    const key = conn.id + "|" + p.googleCalendarId;
    if (seen.has(key)) continue;
    seen.add(key);
    const current = conn.watches.filter((w) => w.calendarId === p.googleCalendarId);
    if (current.some((w) => w.expiresAt.getTime() > Date.now() + 86400_000)) continue;
    try {
      const token = await getAccessToken(conn);
      const channelId = crypto.randomUUID();
      const channelToken = randomToken(24);
      const res = await googleApi().watchEvents(token, p.googleCalendarId!, { id: channelId, token: channelToken, address: `${base}/api/google/webhook`, ttlSeconds: TTL_SECONDS });
      await db.googleCalendarWatch.create({
        data: { organizationId: conn.organizationId, connectionId: conn.id, calendarId: p.googleCalendarId!, channelId, resourceId: res.resourceId, tokenHash: sha256(channelToken), expiresAt: res.expiration },
      });
      for (const old of current) {
        await googleApi().stopChannel(token, old.channelId, old.resourceId);
        await db.googleCalendarWatch.delete({ where: { id: old.id } });
      }
      created++;
    } catch (e) {
      await logIntegrationError({ organizationId: conn.organizationId, integration: "GOOGLE", operation: "watch", message: (e as Error).message, details: { status: e instanceof GoogleApiError ? e.status : null } });
    }
  }
  return { created, skipped: null };
}

export async function handleGoogleNotification(h: { channelId: string | null; token: string | null; resourceState: string | null }): Promise<boolean> {
  if (!h.channelId || !h.token) return false;
  const w = await db.googleCalendarWatch.findUnique({ where: { channelId: h.channelId } });
  if (!w || !safeEqual(w.tokenHash, sha256(h.token))) return false;
  if (h.resourceState !== "sync") await invalidateBusyCache(w.connectionId, w.calendarId);
  return true;
}
