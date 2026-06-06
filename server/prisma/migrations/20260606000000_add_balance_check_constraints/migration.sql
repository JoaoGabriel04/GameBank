-- CHECK constraints de saldo não-negativo (coins/diamonds).
-- Idempotente: em dev já existem (criadas via SQL direto); em produção serão criadas no migrate deploy.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_coins_nao_negativo') THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_coins_nao_negativo" CHECK (coins >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_diamonds_nao_negativo') THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_diamonds_nao_negativo" CHECK (diamonds >= 0);
  END IF;
END $$;
