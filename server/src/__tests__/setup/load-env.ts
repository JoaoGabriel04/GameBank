// Roda como setupFiles — ANTES de qualquer módulo de produção ser importado.
// Sobrescreve as variáveis do container pelo .env.test (banco de teste isolado).
// O `override: true` é essencial: o container já injeta DATABASE_URL apontando
// para o banco de dev, e o dotenv padrão NÃO sobrescreve vars existentes.
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.test"), override: true });
