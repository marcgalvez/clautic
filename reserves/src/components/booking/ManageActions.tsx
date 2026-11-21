"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Dict } from "@/lib/i18n/ca";
import { type PickedSlot, SlotPicker } from "./SlotPicker";

export function ManageActions(p: { token: string; locale: string; t: Dict["manage"]; booking: Dict["booking"]; weekdaysShort: string[]; allowCancel: boolean; allowReschedule: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "reschedule">("idle");
  const [slot, setSlot] = useState<PickedSlot | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(body: object, okText: string) {
    setBusy(true);
    setMsg(null);
    const r = await fetch(`/api/public/manage/${p.token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (r.ok) {
      setMsg({ ok: true, text: okText });
      setMode("idle");
      router.refresh();
    } else setMsg({ ok: false, text: r.status === 409 ? p.booking.slotTaken : "⚠️" });
  }

  return (
    <div className="mt-4 space-y-3">
      <div aria-live="polite">{msg && <p className={`rounded-lg p-3 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{msg.text}</p>}</div>
      {mode === "reschedule" ? (
        <section className="card">
          <h2 className="mb-4 font-semibold">{p.t.newTime}</h2>
          <SlotPicker endpoint={`/api/public/manage/${p.token}/availability`} params={{}} locale={p.locale} weekdaysShort={p.weekdaysShort} t={p.booking} selected={slot?.start} onSelect={setSlot} />
          <div className="mt-4 flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => setMode("idle")}>←</button>
            <button className="btn-primary flex-1" disabled={!slot || busy} onClick={() => send({ action: "reschedule", start: slot!.start }, p.t.rescheduled)}>
              {p.t.doReschedule}
            </button>
          </div>
        </section>
      ) : (
        <>
          {p.allowReschedule && <button className="btn-primary w-full" onClick={() => setMode("reschedule")}>{p.t.reschedule}</button>}
          {p.allowCancel && (
            <button className="btn-danger w-full" disabled={busy} onClick={() => window.confirm(p.t.cancelConfirm) && send({ action: "cancel" }, p.t.cancelledOk)}>
              {p.t.cancel}
            </button>
          )}
        </>
      )}
    </div>
  );
}
