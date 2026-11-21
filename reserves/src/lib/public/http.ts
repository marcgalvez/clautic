import { NextResponse } from "next/server";
import { env } from "../env";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

export function ipOf(req: Request) {
  return (req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
}

/** Les peticions que modifiquen dades han de venir del nostre domini (protecció CSRF). */
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return true; // clients sense navegador; continuen limitats per rate limit
  const appHost = new URL(env().APP_URL).host; // fora del try: un error de configuració no s'ha d'amagar
  try {
    return new URL(origin).host === appHost || new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}
