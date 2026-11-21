import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { encrypt, hmacSha256Hex, safeEqual } from "@/lib/crypto";
import { decodeIdToken, googleApi } from "@/lib/google/api";
import { audit, logIntegrationError } from "@/lib/audit";

export async function GET(req: Request) {
  const back = (s: "ok" | "error") => NextResponse.redirect(`${env().APP_URL}/panell/integracions?google=${s}`);
  const sp = new URL(req.url).searchParams;
  const jar = await cookies();
  const raw = jar.get("g_oauth")?.value ?? "";
  jar.delete({ name: "g_oauth", path: "/api/google" });
  const [orgId, userId, nonce, sig] = raw.split(".");
  if (!orgId || !sig || !safeEqual(sig, hmacSha256Hex(env().ENCRYPTION_KEY, `${orgId}.${userId}.${nonce}`)) || sp.get("state") !== nonce) return back("error");
  const member = await db.organizationMember.findFirst({ where: { organizationId: orgId, userId, role: { in: ["OWNER", "ADMIN"] } } });
  const code = sp.get("code");
  if (!member || !code) return back("error");

  try {
    const tokens = await googleApi().exchangeCode(code, `${env().APP_URL}/api/google/oauth/callback`);
    const granted = tokens.scope.split(" ");
    const needed = ["https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/calendar.freebusy"];
    if (!needed.every((s) => granted.includes(s)) || !tokens.refreshToken || !tokens.idToken) {
      await logIntegrationError({ organizationId: orgId, integration: "GOOGLE", operation: "oauth", message: "Permisos insuficients o sense refresh token", details: { granted } });
      if (tokens.accessToken) await googleApi().revoke(tokens.accessToken);
      return back("error");
    }
    const { sub, email } = decodeIdToken(tokens.idToken);
    const data = { googleEmail: email, accessTokenEnc: encrypt(tokens.accessToken), refreshTokenEnc: encrypt(tokens.refreshToken), accessExpiresAt: tokens.expiresAt, scopes: tokens.scope, status: "ACTIVE" as const, lastError: null };
    const conn = await db.googleCalendarConnection.upsert({
      where: { organizationId_googleSub: { organizationId: orgId, googleSub: sub } },
      create: { organizationId: orgId, googleSub: sub, createdById: userId, ...data },
      update: data,
    });
    // Comoditat: si cap professional té calendari, assignem el principal al primer.
    const any = await db.professional.count({ where: { organizationId: orgId, googleCalendarId: { not: null } } });
    if (!any) {
      const first = await db.professional.findFirst({ where: { organizationId: orgId, active: true }, orderBy: { sortOrder: "asc" } });
      if (first) await db.professional.update({ where: { id: first.id }, data: { googleConnectionId: conn.id, googleCalendarId: "primary" } });
    }
    await audit({ organizationId: orgId, actorUserId: userId, action: "google.connected", metadata: { email } });
    return back("ok");
  } catch (e) {
    await logIntegrationError({ organizationId: orgId, integration: "GOOGLE", operation: "oauth", message: (e as Error).message });
    return back("error");
  }
}
