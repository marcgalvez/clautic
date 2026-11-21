import { env } from "../env";

/**
 * Client mínim de l'API oficial de Google (OAuth 2.0 + Calendar v3) sobre fetch.
 * Està darrere d'una interfície perquè les proves puguin substituir-lo.
 */
export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly", // llistar calendaris per triar-ne un
  "https://www.googleapis.com/auth/calendar.events", // crear/modificar/esborrar les cites
  "https://www.googleapis.com/auth/calendar.freebusy", // consultar ocupació
];

export class GoogleApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public reason?: string,
  ) {
    super(message);
  }
  /** Errors temporals que justifiquen reintent (límits, 5xx, xarxa). */
  get retryable() {
    return this.status === 0 || this.status === 429 || this.status >= 500 || this.reason === "rateLimitExceeded" || this.reason === "userRateLimitExceeded";
  }
  get revoked() {
    return this.reason === "invalid_grant" || this.status === 401;
  }
}

export type TokenSet = { accessToken: string; refreshToken?: string; expiresAt: Date; scope: string; idToken?: string };
export type GoogleEvent = {
  id?: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  transparency?: "opaque" | "transparent";
  status?: "confirmed" | "cancelled";
  extendedProperties?: { private?: Record<string, string> };
  reminders?: { useDefault: boolean };
};

export interface GoogleApi {
  exchangeCode(code: string, redirectUri: string): Promise<TokenSet>;
  refresh(refreshToken: string): Promise<TokenSet>;
  revoke(token: string): Promise<void>;
  listCalendars(accessToken: string): Promise<{ id: string; summary: string; primary?: boolean; accessRole: string }[]>;
  freeBusy(accessToken: string, calendarIds: string[], timeMin: Date, timeMax: Date): Promise<Record<string, { start: string; end: string }[]>>;
  insertEvent(accessToken: string, calendarId: string, ev: GoogleEvent): Promise<{ id: string }>;
  updateEvent(accessToken: string, calendarId: string, eventId: string, ev: GoogleEvent): Promise<{ id: string }>;
  deleteEvent(accessToken: string, calendarId: string, eventId: string): Promise<void>;
  watchEvents(accessToken: string, calendarId: string, body: { id: string; token: string; address: string; ttlSeconds: number }): Promise<{ resourceId: string; expiration: Date }>;
  stopChannel(accessToken: string, channelId: string, resourceId: string): Promise<void>;
}

async function call<T>(url: string, init: RequestInit & { accessToken?: string } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.accessToken) headers.set("Authorization", `Bearer ${init.accessToken}`);
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(10_000) });
  } catch (e) {
    throw new GoogleApiError(`Error de xarxa amb Google: ${(e as Error).message}`, 0);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const reason = json.error?.errors?.[0]?.reason ?? (typeof json.error === "string" ? json.error : undefined);
    throw new GoogleApiError(json.error?.message ?? json.error_description ?? `Google HTTP ${res.status}`, res.status, reason);
  }
  return json as T;
}

const CAL = "https://www.googleapis.com/calendar/v3";
const enc = encodeURIComponent;

function toTokenSet(j: { access_token: string; refresh_token?: string; expires_in: number; scope: string; id_token?: string }): TokenSet {
  return { accessToken: j.access_token, refreshToken: j.refresh_token, expiresAt: new Date(Date.now() + (j.expires_in - 60) * 1000), scope: j.scope, idToken: j.id_token };
}

const realApi: GoogleApi = {
  async exchangeCode(code, redirectUri) {
    const e = env();
    const j = await call<Parameters<typeof toTokenSet>[0]>("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: e.GOOGLE_CLIENT_ID!, client_secret: e.GOOGLE_CLIENT_SECRET!, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    });
    return toTokenSet(j);
  },
  async refresh(refreshToken) {
    const e = env();
    const j = await call<Parameters<typeof toTokenSet>[0]>("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ refresh_token: refreshToken, client_id: e.GOOGLE_CLIENT_ID!, client_secret: e.GOOGLE_CLIENT_SECRET!, grant_type: "refresh_token" }),
    });
    return toTokenSet(j);
  },
  async revoke(token) {
    await call("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    }).catch(() => undefined);
  },
  async listCalendars(accessToken) {
    const j = await call<{ items: { id: string; summary: string; primary?: boolean; accessRole: string }[] }>(`${CAL}/users/me/calendarList?minAccessRole=writer`, { accessToken });
    return j.items ?? [];
  },
  async freeBusy(accessToken, calendarIds, timeMin, timeMax) {
    const j = await call<{ calendars: Record<string, { busy: { start: string; end: string }[]; errors?: unknown[] }> }>(`${CAL}/freeBusy`, {
      method: "POST",
      accessToken,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(), items: calendarIds.map((id) => ({ id })) }),
    });
    const out: Record<string, { start: string; end: string }[]> = {};
    for (const id of calendarIds) {
      const c = j.calendars?.[id];
      if (!c || c.errors?.length) throw new GoogleApiError(`FreeBusy sense dades per al calendari ${id}`, 502);
      out[id] = c.busy ?? [];
    }
    return out;
  },
  insertEvent: (accessToken, calendarId, ev) =>
    call(`${CAL}/calendars/${enc(calendarId)}/events?sendUpdates=none`, { method: "POST", accessToken, headers: { "Content-Type": "application/json" }, body: JSON.stringify(ev) }),
  updateEvent: (accessToken, calendarId, eventId, ev) =>
    call(`${CAL}/calendars/${enc(calendarId)}/events/${enc(eventId)}?sendUpdates=none`, { method: "PUT", accessToken, headers: { "Content-Type": "application/json" }, body: JSON.stringify(ev) }),
  async deleteEvent(accessToken, calendarId, eventId) {
    try {
      await call(`${CAL}/calendars/${enc(calendarId)}/events/${enc(eventId)}?sendUpdates=none`, { method: "DELETE", accessToken });
    } catch (e) {
      if (e instanceof GoogleApiError && (e.status === 404 || e.status === 410)) return; // ja no hi és
      throw e;
    }
  },
  async watchEvents(accessToken, calendarId, b) {
    const j = await call<{ resourceId: string; expiration: string }>(`${CAL}/calendars/${enc(calendarId)}/events/watch`, {
      method: "POST",
      accessToken,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: b.id, type: "web_hook", address: b.address, token: b.token, params: { ttl: String(b.ttlSeconds) } }),
    });
    return { resourceId: j.resourceId, expiration: new Date(Number(j.expiration)) };
  },
  async stopChannel(accessToken, channelId, resourceId) {
    await call(`${CAL}/channels/stop`, { method: "POST", accessToken, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: channelId, resourceId }) }).catch(() => undefined);
  },
};

let current: GoogleApi = realApi;
export const googleApi = (): GoogleApi => current;
/** Només per a proves. */
export function __setGoogleApi(api: GoogleApi | null) {
  current = api ?? realApi;
}

export function decodeIdToken(idToken: string): { sub: string; email: string } {
  // El token arriba directament de l'endpoint de Google per TLS: n'hi ha prou amb descodificar-lo.
  const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8"));
  return { sub: payload.sub, email: payload.email };
}
