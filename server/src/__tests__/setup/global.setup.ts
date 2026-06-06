// Roda UMA vez antes de todos os testes (processo separado).
// Aplica as migrations no banco de teste para garantir o schema atualizado.
import { config } from "dotenv";
import { resolve } from "path";
import { execSync } from "child_process";

export default async function globalSetup() {
  config({ path: resolve(process.cwd(), ".env.test"), override: true });

  if (!/gamebank_test/.test(process.env.DATABASE_URL ?? "")) {
    throw new Error(
      "globalSetup abortado: DATABASE_URL não aponta para o banco de teste (gamebank_test)."
    );
  }

  try {
    execSync("npx prisma migrate deploy", { env: { ...process.env }, stdio: "pipe" });
    console.log("\n✓ Banco de teste migrado");
  } catch (error: any) {
    console.error("✗ Falha ao migrar banco de teste:", error?.stdout?.toString?.() ?? error);
    throw error;
  }
}
