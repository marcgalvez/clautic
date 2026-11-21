import type { Prisma } from "@prisma/client";
import { db } from "./db";

export async function audit(entry: {
  organizationId?: string | null;
  actorUserId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
  ip?: string | null;
}) {
  try {
    await db.auditLog.create({ data: { ...entry, organizationId: entry.organizationId ?? null } });
  } catch (e) {
    console.error("audit log failed", e);
  }
}

export async function logIntegrationError(entry: {
  organizationId?: string | null;
  integration: "GOOGLE" | "WHATSAPP";
  operation: string;
  message: string;
  details?: Prisma.InputJsonValue;
}) {
  console.error(`[${entry.integration}] ${entry.operation}: ${entry.message}`);
  try {
    await db.integrationErrorLog.create({ data: { ...entry, message: entry.message.slice(0, 2000) } });
  } catch (e) {
    console.error("integration log failed", e);
  }
}
