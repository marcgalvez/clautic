"use client";
import { useMemo, useState } from "react";
import type { Dict } from "@/lib/i18n/ca";
import { type PickedSlot, SlotPicker } from "./SlotPicker";

type Service = { id: string; name: string; description: string | null; duration: number; price: string; professionalIds: string[] };
type Pro = { id: string; name: string; color: string };
type Confirmation = { manageUrl: string; appointment: { center: string; address: string | null; service: string; professional: string; date: string; time: string; duration: number; reminder: boolean } };

const ucf = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const PREFIXES = ["+34", "+376", "+33", "+351", "+44", "+49", "+39", "+41", "+31", "+32", "+1", "+52", "+54", "+57", "+212"];

export function BookingFlow(props: {
  slug: string;
  locale: string;
  t: Dict["booking"];
  weekdaysShort: string[];
  minutesLabel: string;
  emailRequirement: "HIDDEN" | "OPTIONAL" | "REQUIRED";
  services: Service[];
  professionals: Pro[];
  privacyText: string;
  termsText: string;
  remindersEnabled: boolean;
}) {
  const { t } = props;
  const [service, setService] = useState<Service | null>(props.services.length === 1 ? props.services[0] : null);
  const [pro, setPro] = useState<Pro | "any" | null>(null);
  const [slot, setSlot] = useState<PickedSlot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Confirmation | null>(null);

  const prosForService = useMemo(() => (service ? props.professionals.filter((p) => service.professionalIds.includes(p.id)) : []), [service, props.professionals]);
  // Si només hi ha un professional, ens saltem el pas.
  const effectivePro: Pro | "any" | null = prosForService.length === 1 ? prosForService[0] : pro;
  const step = !service ? 1 : !effectivePro ? 2 : !slot ? 3 : 4;

  if (done) return <Confirmed c={done} t={t} minutes={props.minutesLabel} />;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const res = await fetch(`/api/public/${props.slug}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: service!.id,
          professionalId: effectivePro === "any" ? null : effectivePro!.id,
          start: slot!.start,
          firstName: f.get("firstName"),
          lastName: f.get("lastName"),
          phonePrefix: f.get("phonePrefix"),
          phone: f.get("phone"),
          email: f.get("email") ?? "",
          whatsappConsent: f.get("whatsappConsent") === "on",
          acceptPrivacy: f.get("acceptPrivacy") === "on",
          locale: props.locale,
          website: f.get("website") ?? "",
        }),
      });
      const j = await res.json();
      if (res.ok && j.ok) {
        setDone(j);
        window.scrollTo({ top: 0 });
      } else if (res.status === 409) {
        setError(t.slotTaken);
        setSlot(null);
      } else if (j.fields?.includes("phone")) setError(t.invalidPhone);
      else setError(j.error === "RATE_LIMIT" ? "⏳" : "⚠️");
    } catch {
      setError("⚠️");
    } finally {
      setBusy(false);
    }
  }

  const StepTitle = ({ n, title, value, onChange }: { n: number; title: string; value?: string; onChange?: () => void }) => (
    <div className="flex items-center justify-between gap-2">
      <h2 className={`flex items-center gap-3 font-semibold ${step === n ? "text-stone-900" : "text-stone-500"}`}>
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm ${step >= n ? "bg-accent text-white" : "bg-stone-200 text-stone-600"}`}>{n}</span>
        <span>
          {title}
          {value && step > n && <span className="block text-sm font-normal text-stone-700">{value}</span>}
        </span>
      </h2>
      {onChange && step > n && (
        <button type="button" onClick={onChange} className="text-sm font-medium text-accent underline">
          {t.change}
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
          {error}
        </p>
      )}
      <section className="card">
        <StepTitle n={1} title={t.stepService} value={service ? `${service.name} · ${service.duration} ${props.minutesLabel}` : undefined} onChange={props.services.length > 1 ? () => { setService(null); setPro(null); setSlot(null); } : undefined} />
        {step === 1 && (
          <ul className="mt-4 space-y-2">
            {props.services.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => { setService(s); setPro(null); setSlot(null); }} className="flex w-full items-center justify-between gap-3 rounded-xl border border-stone-200 p-4 text-left hover:border-accent hover:bg-accent/5">
                  <span>
                    <span className="block font-medium">{s.name}</span>
                    {s.description && <span className="block text-sm text-stone-600">{s.description}</span>}
                    <span className="block text-sm text-stone-500">{s.duration} {props.minutesLabel}</span>
                  </span>
                  {s.price && <span className="font-semibold whitespace-nowrap">{s.price}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {service && prosForService.length > 1 && (
        <section className="card">
          <StepTitle n={2} title={t.stepProfessional} value={effectivePro === "any" ? t.anyProfessional : effectivePro?.name} onChange={() => { setPro(null); setSlot(null); }} />
          {step === 2 && (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {[{ id: "any", name: t.anyProfessional, color: "#a8a29e" }, ...prosForService].map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => { setPro(p.id === "any" ? "any" : (p as Pro)); setSlot(null); }} className="flex w-full items-center gap-3 rounded-xl border border-stone-200 p-4 text-left font-medium hover:border-accent hover:bg-accent/5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full text-sm text-white" style={{ background: p.color }} aria-hidden>
                      {p.id === "any" ? "★" : p.name.slice(0, 1)}
                    </span>
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {service && effectivePro && (
        <section className="card">
          <StepTitle n={3} title={t.stepDate} value={slot ? `${ucf(new Intl.DateTimeFormat(props.locale, { weekday: "long", day: "numeric", month: "long" }).format(new Date(slot.date + "T12:00:00")))} · ${slot.time}` : undefined} onChange={() => setSlot(null)} />
          {step === 3 && (
            <div className="mt-4">
              <SlotPicker
                endpoint={`/api/public/${props.slug}/availability`}
                params={{ serviceId: service.id, ...(effectivePro !== "any" ? { professionalId: effectivePro.id } : {}) }}
                locale={props.locale}
                weekdaysShort={props.weekdaysShort}
                t={t}
                selected={slot?.start}
                onSelect={setSlot}
              />
            </div>
          )}
        </section>
      )}

      {step === 4 && (
        <form className="card space-y-4" onSubmit={submit}>
          <StepTitle n={4} title={t.stepDetails} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="firstName">{t.firstName}</label>
              <input id="firstName" name="firstName" required maxLength={60} autoComplete="given-name" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="lastName">{t.lastName}</label>
              <input id="lastName" name="lastName" required maxLength={80} autoComplete="family-name" className="input" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="phone">{t.mobile}</label>
            <div className="flex gap-2">
              <label htmlFor="phonePrefix" className="sr-only">{t.prefix}</label>
              <select id="phonePrefix" name="phonePrefix" className="input w-28" defaultValue="+34">
                {PREFIXES.map((p) => <option key={p}>{p}</option>)}
              </select>
              <input id="phone" name="phone" type="tel" inputMode="tel" required autoComplete="tel-national" className="input flex-1" placeholder="600 00 00 00" />
            </div>
          </div>
          {props.emailRequirement !== "HIDDEN" && (
            <div>
              <label className="label" htmlFor="email">{props.emailRequirement === "REQUIRED" ? t.emailLabel : t.emailOptional}</label>
              <input id="email" name="email" type="email" required={props.emailRequirement === "REQUIRED"} autoComplete="email" className="input" />
            </div>
          )}
          {/* camp trampa invisible per a bots */}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
          {props.remindersEnabled && (
            <label className="flex items-start gap-3 rounded-xl bg-emerald-50/60 p-3 text-sm">
              <input type="checkbox" name="whatsappConsent" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]" />
              <span>💬 {t.whatsappConsent}</span>
            </label>
          )}
          <details className="rounded-xl bg-stone-50 p-3 text-sm text-stone-700">
            <summary className="cursor-pointer font-medium">{t.privacyTitle}{props.termsText ? ` · ${t.termsTitle}` : ""}</summary>
            <p className="mt-2 whitespace-pre-line">{props.privacyText}</p>
            {props.termsText && <p className="mt-3 whitespace-pre-line">{props.termsText}</p>}
          </details>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="acceptPrivacy" required className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]" />
            <span>{t.acceptPrivacy}</span>
          </label>
          <div className="rounded-xl border border-stone-200 p-3 text-sm">
            <div className="font-semibold">{t.summary}</div>
            <div className="mt-1 text-stone-700">
              {service!.name} · {service!.duration} {props.minutesLabel}
              {service!.price && ` · ${service!.price}`}
              <br />
              {ucf(new Intl.DateTimeFormat(props.locale, { weekday: "long", day: "numeric", month: "long" }).format(new Date(slot!.date + "T12:00:00")))} · {slot!.time}
              {effectivePro !== "any" && ` · ${t.with} ${effectivePro!.name}`}
            </div>
          </div>
          <button type="submit" disabled={busy} className="btn-primary w-full py-3 text-base">
            {busy ? t.confirming : t.confirm}
          </button>
        </form>
      )}
    </div>
  );
}

function Confirmed({ c, t, minutes }: { c: Confirmation; t: Dict["booking"]; minutes: string }) {
  const a = c.appointment;
  const rows: [string, string | null][] = [
    [t.center, a.center],
    [t.service, a.service],
    [t.professional, a.professional],
    [t.duration, `${a.duration} ${minutes}`],
    [t.address, a.address],
  ];
  return (
    <section className="card text-center" aria-live="polite">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl" aria-hidden>
        ✓
      </div>
      <h2 className="mt-4 text-2xl font-bold">{t.confirmedTitle}</h2>
      <p className="mt-3 text-lg font-semibold">{a.date}</p>
      <p className="text-3xl font-bold tabular-nums">{a.time}</p>
      <dl className="mx-auto mt-6 max-w-sm space-y-2 text-left text-sm">
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 border-b border-stone-100 pb-2">
            <dt className="text-stone-500">{k}</dt>
            <dd className="text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      {a.reminder && <p className="mt-5 text-sm text-stone-600">💬 {t.reminderInfo}</p>}
      <p className="mt-5 text-sm text-stone-600">{t.confirmedText}</p>
      <a href={c.manageUrl} className="btn-primary mt-3">{t.manageLink}</a>
      <div className="mt-4">
        <button type="button" onClick={() => window.location.reload()} className="text-sm text-stone-600 underline">
          {t.bookAnother}
        </button>
      </div>
    </section>
  );
}
