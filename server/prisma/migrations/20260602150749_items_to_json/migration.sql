-- 1. Adicionar coluna items ao user
ALTER TABLE "users" ADD COLUMN "items" JSONB NOT NULL DEFAULT '[]';

-- 2. Migrar dados de usuario_itens → JSON
UPDATE "users" u SET "items" = COALESCE((
  SELECT jsonb_agg(
    jsonb_build_object(
      'id',          si.id,
      'name',        si.name,
      'description', si.description,
      'type',        si.type,
      'value',       si.value,
      'icon',        si.icon,
      'equipped',    ui.equipped,
      'acquiredAt',  ui."acquiredAt"::text
    ) ORDER BY ui.id
  )
  FROM "usuario_itens" ui
  JOIN "loja_itens" si ON si.id = ui."itemId"
  WHERE ui."userId" = u.id
), '[]'::jsonb);

-- 3. Adicionar "Padrão" (cinza) para TODOS os usuários no início do array
--    equipped=true somente se o usuário não tem banner equipado (banner IS NULL)
UPDATE "users" SET "items" =
  jsonb_insert(
    "items",
    '{0}',
    jsonb_build_object(
      'id',          0,
      'name',        'Padrão',
      'description', 'Banner padrão do jogador',
      'type',        'banner',
      'value',       null,
      'icon',        null,
      'equipped',    ("banner" IS NULL),
      'acquiredAt',  NOW()::text
    )
  );

-- 4. Remover a tabela antiga
DROP TABLE "usuario_itens";
