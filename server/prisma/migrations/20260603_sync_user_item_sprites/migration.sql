-- SyncUserItemSprites: populate spriteId on items[] that were created
-- before the User.spriteId column existed. The previous migration
-- (20260602150749_items_to_json) aggregated items into the JSON column
-- without including the spriteId key, because the column did not exist yet.
--
-- This migration walks every user, joins each item of type='banner' to its
-- ShopItem → Banner, and copies Banner.spriteId into the item JSON when
-- the item has no spriteId set.
--
-- Idempotent: a second run is a no-op (the WHERE filters out already-set values).

-- 1. Populate items[].spriteId from Banner.spriteId for any banner item
--    that currently has spriteId = NULL and a non-zero id (Padrão is id=0
--    and correctly stays null).
UPDATE "users" u
SET "items" = (
  SELECT COALESCE(jsonb_agg(
    CASE
      WHEN (item->>'type') = 'banner'
       AND (item->>'spriteId') IS NULL
       AND (item->>'id')::int > 0
       AND b."spriteId" IS NOT NULL
      THEN jsonb_set(item, '{spriteId}', to_jsonb(b."spriteId"), true)
      ELSE item
    END
    ORDER BY (item->>'id')::int
  ), '[]'::jsonb)
  FROM jsonb_array_elements(u.items) item
  LEFT JOIN "loja_itens" si ON si.id = (item->>'id')::int
  LEFT JOIN "banners" b ON b.id = si."bannerId"
);

-- 2. Populate User.spriteId from the equipped banner item for users who
--    have a banner set on the user record but no spriteId yet.
UPDATE "users" u
SET "spriteId" = (
  SELECT item->>'spriteId'
  FROM jsonb_array_elements(u.items) item
  WHERE (item->>'equipped')::boolean = true
    AND (item->>'type') = 'banner'
    AND (item->>'id')::int > 0
  LIMIT 1
)
WHERE u."banner" IS NOT NULL
  AND u."spriteId" IS NULL;
