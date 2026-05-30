/** Normaliza email para comparação/armazenamento (chave única case-insensitive). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
}
