import { z } from "zod";

// Variables d'entorn validades. Res d'aquí arriba mai al navegador
// (cap variable porta el prefix NEXT_PUBLIC_).
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  APP_URL: z.string().url().default("http://localhost:3000"),
  APP_NAME: z.string().default("Reserves"),
  // 32 bytes en base64 (openssl rand -base64 32)
  ENCRYPTION_KEY: z.string().min(40),
  CRON_SECRET: z.string().min(16).optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  WHATSAPP_PROVIDER: z.enum(["meta_cloud", "log", "none"]).default("none"),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_DISPLAY_PHONE: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_TEMPLATE_REMINDER: z.string().default("recordatori_cita"),
  WHATSAPP_GRAPH_VERSION: z.string().default("v23.0"),
});

export type Env = z.infer<typeof schema>;
let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error("Configuració d'entorn invàlida: " + parsed.error.issues.map((i) => i.path.join(".")).join(", "));
  }
  if (parsed.data.NODE_ENV === "production" && parsed.data.WHATSAPP_PROVIDER === "log") {
    throw new Error("WHATSAPP_PROVIDER=log no està permès en producció");
  }
  cached = parsed.data;
  return cached;
}

export function googleConfigured(): boolean {
  const e = env();
  return Boolean(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET);
}

export function whatsappMode(): "meta_cloud" | "log" | "none" {
  const e = env();
  if (e.WHATSAPP_PROVIDER === "meta_cloud" && (!e.WHATSAPP_ACCESS_TOKEN || !e.WHATSAPP_PHONE_NUMBER_ID)) return "none";
  return e.WHATSAPP_PROVIDER;
}
