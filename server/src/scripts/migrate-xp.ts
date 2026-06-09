import { migrateXpToPerLevel } from "../utils/migrate-xp-to-per-level.js";

migrateXpToPerLevel()
  .then(() => {
    console.log("Migração concluída com sucesso.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Erro na migração:", err);
    process.exit(1);
  });
