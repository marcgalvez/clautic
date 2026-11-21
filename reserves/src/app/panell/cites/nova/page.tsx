import { db } from "@/lib/db";
import { requireOrgAdmin } from "@/lib/auth/guards";
import { getT } from "@/lib/i18n";
import { Card, PageHeader } from "@/components/ui";
import { AppointmentForm } from "@/components/AppointmentForm";
import { createAppointmentAction } from "../../actions";

export default async function NewAppointment({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireOrgAdmin();
  const { t, locale } = await getT(ctx.user.locale);
  const ta = t.dash.appt;
  const [services, pros] = await Promise.all([
    db.service.findMany({ where: { organizationId: ctx.orgId, active: true }, include: { professionals: true }, orderBy: { name: "asc" } }),
    db.professional.findMany({ where: { organizationId: ctx.orgId, active: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title={ta.newTitle} />
      <Card className="max-w-2xl">
        <AppointmentForm
          action={createAppointmentAction}
          mode="create"
          services={services.map((s) => ({ id: s.id, name: `${s.name} · ${s.durationMinutes} min`, professionalIds: s.professionals.map((p) => p.professionalId) }))}
          professionals={pros.map((p) => ({ id: p.id, name: p.name }))}
          defaults={{ date: sp.date }}
          locale={locale}
          weekdaysShort={t.common.weekdaysShort}
          L={{ service: ta.service, professional: ta.professional, any: t.booking.anyProfessional, pickSlot: ta.pickSlot, noSlots: t.booking.noSlots, loading: t.booking.loading, noDays: t.booking.noDays, date: t.common.date, time: t.common.time, ignoreRules: ta.ignoreRules, customer: ta.customer, firstName: t.booking.firstName, lastName: t.booking.lastName, phone: t.booking.mobile, email: t.common.email, consentGiven: ta.consentGiven, note: ta.internalNote, submit: t.common.create }}
        />
      </Card>
    </>
  );
}
