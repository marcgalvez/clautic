import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { tick } from "@/lib/jobs/tick";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Per a plataformes amb cron extern (Vercel Cron, cron-job.org…). Protegit amb CRON_SECRET.
async function handle(req: Request) {
  const secret = env().CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return new Response("Unauthorized", { status: 401 });
  return Response.json(await tick());
}
export const GET = handle;
export const POST = handle;
