import { hmacSha256Hex, safeEqual } from "../crypto";

/** Verifica la capçalera X-Hub-Signature-256 amb el secret de l'app de Meta. */
export function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string | undefined): boolean {
  if (!header || !appSecret || !header.startsWith("sha256=")) return false;
  return safeEqual(header.slice(7), hmacSha256Hex(appSecret, rawBody));
}
