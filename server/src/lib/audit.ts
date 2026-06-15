import { prisma } from "./prisma.js";

export type AuditSeverity = "info" | "success" | "warn" | "danger";

export interface AuditLogInput {
  userId?: number | null;
  action: string;
  target?: string | null;
  metadata?: Record<string, unknown> | null;
  severity?: AuditSeverity;
}

export async function auditLog(input: AuditLogInput): Promise<void> {
  const data = {
    userId: input.userId ?? null,
    action: input.action,
    target: input.target ?? null,
    metadata: input.metadata as any,
    severity: input.severity ?? "info",
  };
  try {
    await prisma.auditLog.create({ data });
  } catch (err: any) {
    // FK violation on userId — user may have been recreated; log without attribution
    if (err?.code === "P2003" && data.userId !== null) {
      try {
        await prisma.auditLog.create({ data: { ...data, userId: null } });
        return;
      } catch {
        // fall through to error log
      }
    }
    console.error("[audit] failed to write log:", err);
  }
}
