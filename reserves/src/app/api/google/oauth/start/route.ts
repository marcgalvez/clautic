import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getOrgContext, isOrgAdmin } from "@/lib/auth/guards";
import { env, googleConfigured } from "@/lib/env";
import { hmacSha256Hex, randomToken } from "@/lib/crypto";
import { GOOGLE_SCOPES } from "@/lib/google/api";

export async function GET() {
  const ctx = await getOrgContext();
  if (!ctx || !isOrgAdmin(ctx) || !googleConfigured()) return NextResponse.redirect(`${env().APP_URL}/panell/integracions?google=error`);
  const nonce = randomToken(16);
  const payload = `${ctx.orgId}.${ctx.user.id}.${nonce}`;
  // Estat signat lligat a l'empresa i l'usuari (protecció CSRF de l'OAuth).
  (await cookies()).set("g_oauth", `${payload}.${hmacSha256Hex(env().ENCRYPTION_KEY, payload)}`, { httpOnly: true, secure: env().APP_URL.startsWith("https"), sameSite: "lax", maxAge: 600, path: "/api/google" });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: env().GOOGLE_CLIENT_ID!,
    redirect_uri: `${env().APP_URL}/api/google/oauth/callback`,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline", // refresh token
    prompt: "consent",
    include_granted_scopes: "true",
    state: nonce,
  }).toString();
  return NextResponse.redirect(url.toString());
}
