-- 1. Inserir registros na tabela banners
INSERT INTO "banners" ("nome", "css", "disponibilidade", "createdAt")
VALUES
  ('Floresta',    'preset:banner-01', true, NOW()),
  ('Oceano',      'preset:banner-02', true, NOW()),
  ('Crepúsculo',  'preset:banner-03', true, NOW())
ON CONFLICT DO NOTHING;

-- 2. Inserir ShopItems para esses banners (price=0, available=false)
INSERT INTO "loja_itens" ("name", "description", "price", "type", "value", "available", "bannerId")
SELECT b.nome,
       'Banner gratuito — disponível para todos os jogadores',
       0,
       'banner',
       b.css,
       false,
       b.id
FROM "banners" b
WHERE b.nome IN ('Floresta', 'Oceano', 'Crepúsculo')
ON CONFLICT DO NOTHING;

-- 3. Dar os 3 banners para todos os usuários existentes
INSERT INTO "usuario_itens" ("userId", "itemId", "equipped", "acquiredAt")
SELECT u.id, si.id, false, NOW()
FROM "users" u
CROSS JOIN "loja_itens" si
WHERE si.name IN ('Floresta', 'Oceano', 'Crepúsculo')
  AND si.price = 0
  AND si.available = false
ON CONFLICT ("userId", "itemId") DO NOTHING;

-- 4. Sincronizar equipped: marcar o UserItem correto para usuários que já têm um banner equipado
UPDATE "usuario_itens" ui
SET "equipped" = true
FROM "loja_itens" si
JOIN "users" u ON u.banner = si.value
WHERE ui."userId" = u.id
  AND ui."itemId" = si.id
  AND si.name IN ('Floresta', 'Oceano', 'Crepúsculo');
