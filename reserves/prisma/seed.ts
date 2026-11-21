// Dades de demostració per provar sense connectar serveis externs.
// NO s'executa en producció. Ús: npm run db:seed
import "dotenv/config";
import { DateTime } from "luxon";
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth/password";
import { createAppointment } from "../src/lib/booking/service";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("El seed de demostració no es pot executar en producció");
  const pw = await hashPassword("demo-demo-demo");

  await db.user.upsert({ where: { email: "admin@demo.local" }, create: { email: "admin@demo.local", name: "Superadmin", passwordHash: pw, isSuperAdmin: true }, update: {} });

  for (const slug of ["perruqueria-maria", "barberia-nova"]) {
    const o = await db.organization.findUnique({ where: { slug } });
    if (o) await db.organization.delete({ where: { id: o.id } });
  }
  await db.user.deleteMany({ where: { email: { in: ["maria@demo.local", "jordi@demo.local", "pau@demo.local"] } } });

  const org = await db.organization.create({
    data: {
      slug: "perruqueria-maria",
      name: "Perruqueria Maria",
      status: "ACTIVE",
      approvedAt: new Date(),
      contactEmail: "maria@demo.local",
      contactPhone: "+34600000001",
      settings: { create: { address: "Carrer Major 12, Girona", phone: "+34 972 00 00 00", minNoticeMinutes: 60, privacyContactEmail: "maria@demo.local", cancellationPolicy: "Pots cancel·lar o canviar la cita fins a 12 hores abans." } },
      subscription: { create: { plan: "BASIC", status: "ACTIVE", purchasedAt: new Date(), startsAt: new Date(), amountCents: 2900, paymentReference: "DEMO-0001" } },
      businessHours: {
        create: [...[1, 2, 3, 4, 5].flatMap((weekday) => [{ weekday, startMinute: 540, endMinute: 840 }, { weekday, startMinute: 960, endMinute: 1200 }]), { weekday: 6, startMinute: 540, endMinute: 840 }],
      },
    },
  });
  const maria = await db.professional.create({ data: { organizationId: org.id, name: "Maria", color: "#0f766e", sortOrder: 0 } });
  const jordi = await db.professional.create({ data: { organizationId: org.id, name: "Jordi", color: "#7c3aed", sortOrder: 1, schedules: { create: [2, 3, 4, 5, 6].map((weekday) => ({ organizationId: org.id, weekday, startMinute: 600, endMinute: 1200 })) } } });
  const svc = [
    ["Tall de cabell", 30, 2000, [maria, jordi]],
    ["Tall i rentat", 45, 2800, [maria, jordi]],
    ["Tint", 90, 5500, [maria]],
    ["Manicura", 45, 2500, [maria]],
  ] as const;
  const services = [];
  for (const [i, [name, dur, price, pros]] of svc.entries()) {
    const s = await db.service.create({ data: { organizationId: org.id, name, durationMinutes: dur, priceCents: price, sortOrder: i, bufferAfterMinutes: name === "Tint" ? 10 : 0 } });
    await db.professionalService.createMany({ data: pros.map((p) => ({ organizationId: org.id, professionalId: p.id, serviceId: s.id })) });
    services.push(s);
  }
  const owner = await db.user.create({ data: { email: "maria@demo.local", name: "Maria Puig", passwordHash: pw } });
  await db.organizationMember.create({ data: { organizationId: org.id, userId: owner.id, role: "OWNER", professionalId: maria.id } });
  const jordiUser = await db.user.create({ data: { email: "jordi@demo.local", name: "Jordi", passwordHash: pw } });
  await db.organizationMember.create({ data: { organizationId: org.id, userId: jordiUser.id, role: "PROFESSIONAL", professionalId: jordi.id } });

  // Cites dels propers dies
  const names = [["Laura", "Serra"], ["Pere", "Vila"], ["Anna", "Font"], ["Marc", "Roca"], ["Núria", "Puig"], ["Jan", "Soler"], ["Clara", "Riera"]];
  let n = 0;
  for (let d = 0; d < 6; d++) {
    const day = DateTime.now().setZone("Europe/Madrid").plus({ days: d }).startOf("day");
    if (day.weekday === 7) continue;
    for (const hour of [10, 11.5, 17]) {
      if (day.weekday === 6 && hour > 14) continue;
      const start = day.plus({ minutes: hour * 60 });
      if (start < DateTime.now().plus({ hours: 1 })) continue;
      const [first, last] = names[n % names.length];
      await createAppointment({
        orgId: org.id,
        serviceId: services[n % services.length].id,
        professionalId: null,
        startsAt: start.toJSDate(),
        customer: { firstName: first, lastName: last, phoneE164: `+3461100${String(1000 + n).slice(-4)}`, email: null, locale: "ca" },
        whatsappConsent: n % 3 !== 0,
        consentText: "Dades de demostració",
        source: n % 2 ? "PUBLIC" : "DASHBOARD",
        actor: { type: "SYSTEM" },
        ignoreRules: true,
      });
      n++;
    }
  }

  // Empresa pendent d'aprovació (per provar el backoffice)
  const pend = await db.organization.create({
    data: { slug: "barberia-nova", name: "Barberia Nova", contactEmail: "pau@demo.local", contactPhone: "+34600000002", settings: { create: {} }, subscription: { create: { status: "PENDING" } }, businessHours: { create: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startMinute: 540, endMinute: 1140 })) } },
  });
  const pau = await db.user.create({ data: { email: "pau@demo.local", name: "Pau Ferrer", passwordHash: pw } });
  const pp = await db.professional.create({ data: { organizationId: pend.id, name: "Pau" } });
  await db.organizationMember.create({ data: { organizationId: pend.id, userId: pau.id, role: "OWNER", professionalId: pp.id } });

  console.log(`Demo llesta: ${n} cites.
  Superadmin:   admin@demo.local / demo-demo-demo
  Empresa:      maria@demo.local / demo-demo-demo  → /reserves/perruqueria-maria
  Professional: jordi@demo.local / demo-demo-demo
  Pendent:      pau@demo.local / demo-demo-demo`);
}
main().finally(() => db.$disconnect());
