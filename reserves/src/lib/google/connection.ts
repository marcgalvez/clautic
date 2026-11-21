import type { GoogleCalendarConnection } from "@prisma/client";
import { db } from "../db";
import { decrypt, encrypt } from "../crypto";
import { logIntegrationError } from "../audit";
import { GoogleApiError, googleApi } from "./api";

/** Retorna un access token vàlid, renovant-lo si cal. Marca la connexió si Google l'ha revocada. */
export async function getAccessToken(conn: GoogleCalendarConnection): Promise<string> {
  if (conn.status === "REVOKED") throw new GoogleApiError("Connexió de Google revocada", 401, "invalid_grant");
  if (conn.accessExpiresAt.getTime() > Date.now() + 30_000) return decrypt(conn.accessTokenEnc);
  try {
    const t = await googleApi().refresh(decrypt(conn.refreshTokenEnc));
    await db.googleCalendarConnection.update({
      where: { id: conn.id },
      data: {
        accessTokenEnc: encrypt(t.accessToken),
        accessExpiresAt: t.expiresAt,
        ...(t.refreshToken ? { refreshTokenEnc: encrypt(t.refreshToken) } : {}),
        status: "ACTIVE",
        lastError: null,
      },
    });
    return t.accessToken;
  } catch (e) {
    const err = e instanceof GoogleApiError ? e : new GoogleApiError(String(e), 0);
    await db.googleCalendarConnection.update({
      where: { id: conn.id },
      data: { status: err.revoked ? "REVOKED" : "ERROR", lastError: err.message, lastErrorAt: new Date() },
    });
    await logIntegrationError({ organizationId: conn.organizationId, integration: "GOOGLE", operation: "token_refresh", message: err.message, details: { status: err.status, reason: err.reason ?? null } });
    throw err;
  }
}

export async function markConnectionError(conn: GoogleCalendarConnection, err: GoogleApiError) {
  await db.googleCalendarConnection.update({
    where: { id: conn.id },
    data: { status: err.revoked ? "REVOKED" : conn.status, lastError: err.message, lastErrorAt: new Date() },
  });
}
