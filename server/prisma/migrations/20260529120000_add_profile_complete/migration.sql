-- Perfil obrigatório: apelido + avatar escolhidos pelo usuário
ALTER TABLE "users" ADD COLUMN "profileComplete" BOOLEAN NOT NULL DEFAULT false;

-- Contas já existentes com apelido preenchido seguem jogando
UPDATE "users"
SET "profileComplete" = true
WHERE TRIM("nome") <> '' AND "avatarUrl" IS NOT NULL;
