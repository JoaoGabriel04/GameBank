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
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        target: input.target ?? null,
        metadata: input.metadata as any,
        severity: input.severity ?? "info",
      },
    });
  } catch (err) {
    console.error("[audit] failed to write log:", err);
  }
}
