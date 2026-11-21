"use server";
import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n";

export async function setLocale(formData: FormData) {
  const l = formData.get("locale");
  if (isLocale(l)) (await cookies()).set(LOCALE_COOKIE, l, { path: "/", maxAge: 365 * 86400, sameSite: "lax" });
}
