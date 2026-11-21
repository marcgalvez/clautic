import { DateTime } from "luxon";

/**
 * Plantilla "recordatori_cita" (categoria UTILITY) que cal donar d'alta a Meta
 * en català (ca) i castellà (es). Variables del cos:
 *   {{1}} nom del client · {{2}} centre · {{3}} data · {{4}} hora · {{5}} servei
 * Botó d'URL dinàmic: https://<domini>/cita/{{1}}  ({{1}} = token de gestió)
 * El text de referència és a docs/WHATSAPP.md.
 */
export function reminderParams(p: { firstName: string; center: string; service: string; startsAt: Date; timezone: string; locale: string }) {
  const dt = DateTime.fromJSDate(p.startsAt).setZone(p.timezone).setLocale(p.locale === "es" ? "es" : "ca");
  const date = dt.toFormat("cccc d 'de' LLLL");
  return [p.firstName, p.center, date.charAt(0).toUpperCase() + date.slice(1), dt.toFormat("HH:mm"), p.service];
}

/** Previsualització del missatge (panell). Ha de coincidir amb la plantilla aprovada. */
export function renderReminderPreview(params: string[], link: string, locale: string): string {
  const [n, c, d, h, s] = params;
  return locale === "es"
    ? `Hola, ${n}! 👋\n\nTe recordamos que mañana tienes una cita en ${c}.\n\n📅 ${d}\n🕒 ${h} h\n✂️ ${s}\n\n¡Te esperamos!\n\nSi necesitas modificar o cancelar la cita, puedes hacerlo aquí: ${link}`
    : `Hola, ${n}! 👋\n\nEt recordem que demà tens una cita a ${c}.\n\n📅 ${d}\n🕒 ${h} h\n✂️ ${s}\n\nT'esperem!\n\nSi necessites modificar o cancel·lar la cita, pots fer-ho aquí: ${link}`;
}
