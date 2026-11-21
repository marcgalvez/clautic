import type { Subscription } from "@prisma/client";
import { DateTime } from "luxon";
import type { Dict } from "@/lib/i18n/ca";
import { Field } from "../ui";

const d = (x: Date | null | undefined) => (x ? DateTime.fromJSDate(x).setZone("Europe/Madrid").toISODate()! : "");

export function SubscriptionFields({ sub, t, withStatus, idPrefix }: { sub: Subscription | null; t: Dict["admin"]; withStatus: boolean; idPrefix: string }) {
  const today = DateTime.now().setZone("Europe/Madrid").toISODate()!;
  const id = (k: string) => `${idPrefix}-${k}`;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={t.plan} htmlFor={id("plan")}>
        <select id={id("plan")} name="plan" defaultValue={sub?.plan ?? "BASIC"} className="input">
          <option value="TRIAL">TRIAL</option>
          <option value="BASIC">BASIC</option>
          <option value="PRO">PRO</option>
        </select>
      </Field>
      {withStatus && (
        <Field label={t.subStatus} htmlFor={id("subStatus")}>
          <select id={id("subStatus")} name="subStatus" defaultValue={sub?.status ?? "PENDING"} className="input">
            {["PENDING", "ACTIVE", "PAST_DUE", "CANCELED", "EXPIRED"].map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
      )}
      <Field label={t.purchasedAt} htmlFor={id("purchasedAt")}>
        <input id={id("purchasedAt")} name="purchasedAt" type="date" defaultValue={d(sub?.purchasedAt) || (withStatus ? "" : today)} className="input" />
      </Field>
      <Field label={t.startsAt} htmlFor={id("startsAt")}>
        <input id={id("startsAt")} name="startsAt" type="date" defaultValue={d(sub?.startsAt) || (withStatus ? "" : today)} className="input" />
      </Field>
      <Field label={t.endsAt} htmlFor={id("endsAt")}>
        <input id={id("endsAt")} name="endsAt" type="date" defaultValue={d(sub?.endsAt)} className="input" />
      </Field>
      <Field label={t.amount} htmlFor={id("amount")}>
        <input id={id("amount")} name="amount" inputMode="decimal" defaultValue={sub?.amountCents != null ? (sub.amountCents / 100).toFixed(2) : ""} className="input" />
      </Field>
      <div className="sm:col-span-2">
        <Field label={t.paymentRef} htmlFor={id("paymentReference")}>
          <input id={id("paymentReference")} name="paymentReference" maxLength={120} defaultValue={sub?.paymentReference ?? ""} className="input" />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label={t.notes} htmlFor={id("notes")}>
          <textarea id={id("notes")} name="notes" rows={2} maxLength={2000} defaultValue={sub?.notes ?? ""} className="input" />
        </Field>
      </div>
    </div>
  );
}
