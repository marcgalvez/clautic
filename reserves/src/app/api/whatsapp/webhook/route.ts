import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { verifyMetaSignature } from "@/lib/whatsapp/webhook";
import { applyWhatsAppStatus } from "@/lib/whatsapp/reminders";

// Verificació de l'endpoint (Meta → GET amb hub.challenge)
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const expected = env().WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (sp.get("hub.mode") === "subscribe" && expected && safeEqual(sp.get("hub.verify_token") ?? "", expected)) return new Response(sp.get("hub.challenge") ?? "", { status: 200 });
  return new Response("Forbidden", { status: 403 });
}

type Payload = { entry?: { changes?: { value?: { statuses?: Parameters<typeof applyWhatsAppStatus>[0][] } }[] }[] };

// Estats de lliurament (sent / delivered / read / failed), signats amb X-Hub-Signature-256
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyMetaSignature(raw, req.headers.get("x-hub-signature-256"), env().WHATSAPP_APP_SECRET)) return new Response("Invalid signature", { status: 401 });
  const body = JSON.parse(raw) as Payload;
  for (const e of body.entry ?? []) for (const c of e.changes ?? []) for (const s of c.value?.statuses ?? []) await applyWhatsAppStatus(s);
  // Els missatges entrants dels clients no es processen a la v1 (no hi ha xat).
  return new Response("OK");
}
