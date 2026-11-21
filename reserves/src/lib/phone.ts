// Normalització a E.164. Acceptem "+34 600 11 22 33", "0034600112233" o, amb
// prefix per separat, "600112233".
export function normalizePhone(raw: string, defaultPrefix = "+34"): string | null {
  let s = raw.replace(/[\s\-().]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (!s.startsWith("+")) s = defaultPrefix.replace(/\s/g, "") + s.replace(/^0+/, "");
  if (!/^\+[1-9]\d{7,14}$/.test(s)) return null;
  // Espanya: mòbils 6xx/7xx i 9 xifres
  if (s.startsWith("+34") && !/^\+34[67]\d{8}$/.test(s)) return null;
  return s;
}

export function maskPhone(e164: string): string {
  return e164.length > 6 ? e164.slice(0, 4) + " ••• " + e164.slice(-3) : e164;
}
