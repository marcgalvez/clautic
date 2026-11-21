"use client";
import { useActionState, useState } from "react";
import { SlotPicker } from "./booking/SlotPicker";
import type { ActionState } from "./ActionForm";

type Opt = { id: string; name: string; professionalIds?: string[] };

/** Formulari del panell per crear o reprogramar una cita amb ajuda d'hores lliures. */
export function AppointmentForm(props: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  mode: "create" | "reschedule";
  appointmentId?: string;
  services: Opt[];
  professionals: Opt[];
  defaults: { serviceId?: string; professionalId?: string; date?: string; time?: string };
  locale: string;
  weekdaysShort: string[];
  L: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(props.action, null);
  const [serviceId, setServiceId] = useState(props.defaults.serviceId ?? props.services[0]?.id ?? "");
  const [proId, setProId] = useState(props.defaults.professionalId ?? "");
  const [date, setDate] = useState(props.defaults.date ?? "");
  const [time, setTime] = useState(props.defaults.time ?? "");
  const [ignore, setIgnore] = useState(false);
  const L = props.L;
  const svc = props.services.find((s) => s.id === serviceId);
  const pros = props.professionals.filter((p) => !svc?.professionalIds || svc.professionalIds.includes(p.id));

  return (
    <form action={formAction} className="space-y-4">
      <div aria-live="polite">
        {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200">{state.error}</p>}
        {state?.ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200">{state.message}</p>}
      </div>
      {props.appointmentId && <input type="hidden" name="id" value={props.appointmentId} />}
      <div className="grid gap-4 sm:grid-cols-2">
        {props.mode === "create" ? (
          <div>
            <label className="label" htmlFor="serviceId">{L.service}</label>
            <select id="serviceId" name="serviceId" value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="input">
              {props.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        ) : null}
        <div>
          <label className="label" htmlFor="professionalId">{L.professional}</label>
          <select id="professionalId" name="professionalId" value={proId} onChange={(e) => setProId(e.target.value)} className="input">
            {props.mode === "create" && <option value="">{L.any}</option>}
            {pros.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>
      <details className="rounded-xl border border-stone-200 p-3" open={props.mode === "create"}>
        <summary className="cursor-pointer text-sm font-medium">{L.pickSlot}</summary>
        <div className="mt-3">
          <SlotPicker
            endpoint="/api/panell/availability"
            params={{ serviceId: props.mode === "create" ? serviceId : (props.defaults.serviceId ?? ""), ...(proId ? { professionalId: proId } : {}), ...(props.appointmentId ? { exclude: props.appointmentId } : {}), ...(ignore ? { ignoreRules: "1" } : {}) }}
            locale={props.locale}
            weekdaysShort={props.weekdaysShort}
            t={{ noSlots: L.noSlots, loading: L.loading, noDays: L.noDays }}
            selected={null}
            onSelect={(s) => { setDate(s.date); setTime(s.time); }}
          />
        </div>
      </details>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="date">{L.date}</label>
          <input id="date" name="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="time">{L.time}</label>
          <input id="time" name="time" type="time" required step={300} value={time} onChange={(e) => setTime(e.target.value)} className="input" />
        </div>
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="ignoreRules" checked={ignore} onChange={(e) => setIgnore(e.target.checked)} className="mt-0.5 h-5 w-5" />
        <span>{L.ignoreRules}</span>
      </label>
      {props.mode === "create" && (
        <fieldset className="space-y-4 border-t border-stone-100 pt-4">
          <legend className="text-sm font-semibold">{L.customer}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="firstName">{L.firstName}</label><input id="firstName" name="firstName" required className="input" /></div>
            <div><label className="label" htmlFor="lastName">{L.lastName}</label><input id="lastName" name="lastName" className="input" /></div>
            <div><label className="label" htmlFor="phone">{L.phone}</label><input id="phone" name="phone" type="tel" required placeholder="+34 600 00 00 00" className="input" /></div>
            <div><label className="label" htmlFor="email">{L.email}</label><input id="email" name="email" type="email" className="input" /></div>
          </div>
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="consent" className="mt-0.5 h-5 w-5" /><span>{L.consentGiven}</span></label>
          <div><label className="label" htmlFor="note">{L.note}</label><textarea id="note" name="note" rows={2} maxLength={500} className="input" /></div>
        </fieldset>
      )}
      <button className="btn-primary" disabled={pending}>{L.submit}</button>
    </form>
  );
}
