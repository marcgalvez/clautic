import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "../db";
import { randomToken, sha256 } from "../crypto";

const COOKIE = "rsv_session";
const TTL_DAYS = 30;

export async function createSession(userId: string, meta: { ip?: string; userAgent?: string | null }) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + TTL_DAYS * 86400_000);
  await db.session.create({ data: { id: sha256(token), userId, expiresAt, ip: meta.ip, userAgent: meta.userAgent ?? undefined } });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: sha256(token) } });
  jar.delete(COOKIE);
}

export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { id: sha256(token) }, include: { user: true } });
  if (!session || session.expiresAt < new Date() || session.user.disabled) return null;
  return session.user;
});
