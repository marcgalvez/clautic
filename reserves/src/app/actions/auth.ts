"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, PASSWORD_MIN, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp, userAgent } from "@/lib/request";
import { getT } from "@/lib/i18n";
import { audit } from "@/lib/audit";
import { RESERVED_SLUGS, slugify } from "@/lib/slug";
import { normalizePhone } from "@/lib/phone";
import type { ActionState } from "@/components/ActionForm";

export async function loginAction(_: ActionState, f: FormData): Promise<ActionState> {
  const { t } = await getT();
  const ip = await clientIp();
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  if (!(await rateLimit(`login:${ip}`, 20, 900)) || !(await rateLimit(`login:${email}`, 8, 900))) return { error: t.common.tooMany };
  const user = await db.user.findUnique({ where: { email } });
  // Comparem sempre (encara que no existeixi) per no revelar quins correus hi ha.
  const ok = await verifyPassword(String(f.get("password") ?? ""), user?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva");
  if (!user || !ok || user.disabled) return { error: t.auth.invalid };
  await createSession(user.id, { ip, userAgent: await userAgent() });
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit({ actorUserId: user.id, action: "auth.login", ip });
  redirect(user.isSuperAdmin ? "/admin" : "/panell");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

const registerSchema = z.object({
  businessName: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(3).max(48),
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(30).optional(),
  password: z.string().min(PASSWORD_MIN).max(200),
  terms: z.literal("on"),
});

export async function registerAction(_: ActionState, f: FormData): Promise<ActionState> {
  const { t, locale } = await getT();
  const ip = await clientIp();
  if (!(await rateLimit(`register:${ip}`, 5, 3600))) return { error: t.common.tooMany };
  const parsed = registerSchema.safeParse(Object.fromEntries(f));
  if (!parsed.success) return { error: t.common.error + " (" + parsed.error.issues.map((i) => i.path.join(".")).join(", ") + ")" };
  const d = parsed.data;
  const slug = slugify(d.slug);
  if (slug.length < 3 || RESERVED_SLUGS.has(slug)) return { error: t.auth.slugTaken };
  if (await db.user.findUnique({ where: { email: d.email } })) return { error: t.auth.emailTaken };
  if (await db.organization.findUnique({ where: { slug } })) return { error: t.auth.slugTaken };

  const user = await db.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { email: d.email, name: d.name, passwordHash: await hashPassword(d.password), locale } });
    const org = await tx.organization.create({
      data: {
        name: d.businessName,
        slug,
        contactEmail: d.email,
        contactPhone: d.phone ? (normalizePhone(d.phone) ?? d.phone) : null,
        settings: { create: { defaultLocale: locale, privacyContactEmail: d.email } },
        subscription: { create: { status: "PENDING" } },
        // Horari inicial: dl–dv 9–14 i 16–20, ds 9–14 (es pot canviar)
        businessHours: {
          create: [
            ...[1, 2, 3, 4, 5].flatMap((weekday) => [
              { weekday, startMinute: 540, endMinute: 840 },
              { weekday, startMinute: 960, endMinute: 1200 },
            ]),
            { weekday: 6, startMinute: 540, endMinute: 840 },
          ],
        },
      },
    });
    const pro = await tx.professional.create({ data: { organizationId: org.id, name: d.name } });
    await tx.organizationMember.create({ data: { organizationId: org.id, userId: user.id, role: "OWNER", professionalId: pro.id } });
    await tx.auditLog.create({ data: { organizationId: org.id, actorUserId: user.id, action: "org.registered", ip } });
    return user;
  });
  await createSession(user.id, { ip, userAgent: await userAgent() });
  redirect("/panell");
}
