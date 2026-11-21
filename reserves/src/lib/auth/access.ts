import type { Organization, Subscription } from "@prisma/client";

export type AccessState = "ACTIVE" | "PENDING_APPROVAL" | "SUSPENDED" | "EXPIRED";

// Una empresa pot rebre reserves i enviar recordatoris només si el
// superadministrador li ha donat accés i aquest no ha caducat.
export function accessState(org: Pick<Organization, "status">, sub?: Pick<Subscription, "endsAt"> | null, now = new Date()): AccessState {
  if (org.status === "PENDING_APPROVAL") return "PENDING_APPROVAL";
  if (org.status === "SUSPENDED") return "SUSPENDED";
  if (sub?.endsAt && sub.endsAt <= now) return "EXPIRED";
  return "ACTIVE";
}
