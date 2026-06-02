-- PopulateBannerSprites: Assign default spriteIds to existing banners
UPDATE "banners"
SET "spriteId" = 
  CASE "nome"
    WHEN 'Floresta' THEN 'palette'
    WHEN 'Oceano' THEN 'sparkles'
    WHEN 'Crepúsculo' THEN 'crown'
    ELSE NULL
  END
WHERE "spriteId" IS NULL;
