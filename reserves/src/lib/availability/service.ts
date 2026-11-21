import { DateTime } from "luxon";
import { db } from "../db";
import { getGoogleBusy } from "../google/busy";
import { computeAvailability, type DayAvailability } from "./engine";
import { type Interval, subtractInterval } from "./intervals";

export const ACTIVE_STATUSES = ["PENDING", "CONFIRMED"] as const;

export type AvailabilityQuery = {
  orgId: string;
  serviceId: string;
  professionalId?: string | null; // null/undefined = qualsevol
  fromDate: string; // YYYY-MM-DD local
  toDate: string;
  mode: "cached" | "live";
  excludeAppointmentId?: string; // en reprogramar, la pròpia cita no ocupa
  ignoreRules?: boolean; // panell: permet saltar-se antelació mínima i horaris
  candidateStart?: Date; // validar només aquesta hora
  now?: Date;
};

export async function getAvailability(q: AvailabilityQuery): Promise<{ days: DayAvailability[]; professionals: { id: string; name: string }[] } | null> {
  const now = q.now ?? new Date();
  const org = await db.organization.findUnique({ where: { id: q.orgId }, include: { settings: true, businessHours: true } });
  if (!org?.settings) return null;
  const s = org.settings;
  const service = await db.service.findFirst({ where: { id: q.serviceId, organizationId: q.orgId, active: true } });
  if (!service) return null;

  const pros = await db.professional.findMany({
    where: { organizationId: q.orgId, active: true, services: { some: { serviceId: service.id } }, ...(q.professionalId ? { id: q.professionalId } : {}) },
    include: { schedules: true, googleConnection: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  if (!pros.length) return { days: [], professionals: [] };

  const tz = s.timezone;
  const rangeStart = DateTime.fromISO(q.fromDate, { zone: tz }).startOf("day").minus({ days: 1 }).toJSDate();
  const rangeEnd = DateTime.fromISO(q.toDate, { zone: tz }).endOf("day").plus({ days: 1 }).toJSDate();
  const proIds = pros.map((p) => p.id);

  const [appointments, timeOff, excluded] = await Promise.all([
    db.appointment.findMany({
      where: { organizationId: q.orgId, professionalId: { in: proIds }, status: { in: [...ACTIVE_STATUSES] }, blockEnd: { gt: rangeStart }, blockStart: { lt: rangeEnd }, ...(q.excludeAppointmentId ? { id: { not: q.excludeAppointmentId } } : {}) },
      select: { professionalId: true, blockStart: true, blockEnd: true },
    }),
    db.timeOff.findMany({ where: { organizationId: q.orgId, endsAt: { gt: rangeStart }, startsAt: { lt: rangeEnd }, OR: [{ professionalId: null }, { professionalId: { in: proIds } }] } }),
    q.excludeAppointmentId ? db.appointment.findFirst({ where: { id: q.excludeAppointmentId, organizationId: q.orgId } }) : null,
  ]);

  const google = await getGoogleBusy(pros, { from: rangeStart, to: rangeEnd }, q.mode);
  const iv = (a: Date, b: Date): Interval => ({ start: a.getTime(), end: b.getTime() });

  const professionals = pros
    .filter((p) => !google.unavailable.has(p.id))
    .map((p) => {
      let g = google.busy.get(p.id) ?? [];
      // L'esdeveniment de Google de la cita que es reprograma no ha de bloquejar-la a ella mateixa.
      if (excluded && excluded.professionalId === p.id && excluded.googleEventId) g = subtractInterval(g, iv(excluded.startsAt, excluded.endsAt));
      return {
        id: p.id,
        schedules: q.ignoreRules ? [] : p.schedules,
        busy: [
          ...appointments.filter((a) => a.professionalId === p.id).map((a) => iv(a.blockStart, a.blockEnd)),
          ...timeOff.filter((t) => t.professionalId === p.id).map((t) => iv(t.startsAt, t.endsAt)),
          ...g,
        ],
      };
    });

  const allDay = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, startMinute: 0, endMinute: 1440 }));
  const days = computeAvailability({
    timezone: tz,
    fromDate: q.fromDate,
    toDate: q.toDate,
    now,
    minNoticeMinutes: q.ignoreRules ? 0 : s.minNoticeMinutes,
    maxAdvanceDays: q.ignoreRules ? 3650 : s.maxAdvanceDays,
    stepMinutes: s.slotStepMinutes,
    service,
    businessHours: q.ignoreRules ? allDay : org.businessHours,
    centerBusy: timeOff.filter((t) => t.professionalId === null).map((t) => iv(t.startsAt, t.endsAt)),
    professionals,
    candidateStart: q.candidateStart?.getTime(),
  });
  return { days, professionals: pros.map((p) => ({ id: p.id, name: p.name })) };
}
