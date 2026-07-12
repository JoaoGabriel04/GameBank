import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Fase 1 de REFORMULACAO_TELA_JOGO.md — economia-core.ts é espelhado
// (Opção A: duplicação controlada, sem workspace compartilhado) entre
// server/src/shared/ e client/src/shared/. Este teste é a garantia de que
// os dois nunca divergem silenciosamente.

const __dirname = dirname(fileURLToPath(import.meta.url));

function lerClientEconomiaCore(): string {
  const candidatos = [
    // Montado em docker-compose.dev.yml só para este teste — o container
    // do server não enxerga client/ por padrão.
    "/app/client-economia-core.ts",
    // Fallback pra rodar fora do Docker, com o monorepo inteiro no disco.
    resolve(__dirname, "../../../../client/src/shared/economia-core.ts"),
  ];
  const caminho = candidatos.find(existsSync);
  if (!caminho) {
    throw new Error(
      "client/src/shared/economia-core.ts não está acessível a partir daqui. " +
      "Confirme o volume 'client-economia-core.ts' em docker-compose.dev.yml."
    );
  }
  return readFileSync(caminho, "utf8");
}

describe("economia-core: espelho client/server", () => {
  test("os dois arquivos são idênticos byte a byte", () => {
    const server = readFileSync(resolve(__dirname, "../../shared/economia-core.ts"), "utf8");
    const client = lerClientEconomiaCore();
    expect(client).toBe(server);
  });
});
