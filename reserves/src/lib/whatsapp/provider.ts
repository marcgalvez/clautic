import { env, whatsappMode } from "../env";

export type TemplateMessage = {
  to: string; // E.164
  template: string;
  language: string; // "ca" | "es"
  bodyParams: string[];
  buttonUrlSuffix?: string; // part variable del botó d'URL
};

export class WhatsAppSendError extends Error {
  constructor(
    message: string,
    public retryable: boolean,
    public code?: string,
  ) {
    super(message);
  }
}

export interface WhatsAppProvider {
  readonly name: string;
  readonly real: boolean; // false = mode de proves, no s'envia res de veritat
  sendTemplate(msg: TemplateMessage, sender?: { phoneNumberId: string }): Promise<{ providerMessageId: string }>;
}

/** Meta WhatsApp Business Cloud API (oficial). */
export class MetaCloudProvider implements WhatsAppProvider {
  readonly name = "meta_cloud";
  readonly real = true;
  async sendTemplate(msg: TemplateMessage, sender?: { phoneNumberId: string }) {
    const e = env();
    const phoneNumberId = sender?.phoneNumberId ?? e.WHATSAPP_PHONE_NUMBER_ID!;
    const components: unknown[] = [{ type: "body", parameters: msg.bodyParams.map((text) => ({ type: "text", text })) }];
    if (msg.buttonUrlSuffix) components.push({ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: msg.buttonUrlSuffix }] });
    let res: Response;
    try {
      res = await fetch(`https://graph.facebook.com/${e.WHATSAPP_GRAPH_VERSION}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${e.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: msg.to.replace(/^\+/, ""),
          type: "template",
          template: { name: msg.template, language: { code: msg.language }, components },
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      throw new WhatsAppSendError(`Error de xarxa: ${(err as Error).message}`, true, "network");
    }
    const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message: string; code: number } };
    if (!res.ok || !json.messages?.[0]?.id) {
      const code = json.error?.code;
      // 130429/131048/131056: límits de ritme; 5xx: temporal. La resta (número invàlid, plantilla...) no es reintenta.
      const retryable = res.status >= 500 || res.status === 429 || [130429, 131048, 131056, 131000].includes(code ?? -1);
      throw new WhatsAppSendError(json.error?.message ?? `HTTP ${res.status}`, retryable, code ? String(code) : String(res.status));
    }
    return { providerMessageId: json.messages[0].id };
  }
}

/** Només desenvolupament: escriu el missatge al registre. Prohibit en producció (env.ts). */
export class LogProvider implements WhatsAppProvider {
  readonly name = "log";
  readonly real = false;
  async sendTemplate(msg: TemplateMessage) {
    console.info("[WHATSAPP:log — NO ENVIAT]", JSON.stringify(msg));
    return { providerMessageId: "log-" + crypto.randomUUID() };
  }
}

let override: WhatsAppProvider | null | undefined;
export function getWhatsAppProvider(): WhatsAppProvider | null {
  if (override !== undefined) return override;
  const mode = whatsappMode();
  if (mode === "meta_cloud") return new MetaCloudProvider();
  if (mode === "log") return new LogProvider();
  return null; // no configurat
}
/** Només per a proves. `undefined` restaura el comportament normal. */
export function __setWhatsAppProvider(p: WhatsAppProvider | null | undefined) {
  override = p;
}
