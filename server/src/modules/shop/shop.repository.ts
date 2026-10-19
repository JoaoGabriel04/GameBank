import { raridadeWeight } from "../../constants/raridade.js";
import { prisma } from "../../lib/prisma.js";
import type { Prisma } from "../../../generated/prisma/index.js";

export interface UserItemRef {
  item_id: number;
  equipped: boolean;
  acquiredAt: string;
}

export function parseUserItems(raw: unknown): UserItemRef[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw as UserItemRef[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as UserItemRef[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function resolveShopItem(item: any) {
  let resolvedValue = item.value;
  let resolvedImageUrl = item.imageUrl;
  let resolvedAnimated = item.animated;

  if (item.type === "banner" && item.banner) {
    resolvedValue = item.banner.css;
    resolvedAnimated = item.banner.animated;
  }

  if (item.type === "frame" && item.frame) {
    resolvedValue = item.frame.css ?? item.frame.imageUrl;
    resolvedImageUrl = item.frame.imageUrl;
    resolvedAnimated = item.frame.animated;
  }

  if (item.type === "badge" && item.badge) {
    resolvedImageUrl = item.badge.imageUrl;
  }

  return {
    ...item,
    value: resolvedValue,
    imageUrl: resolvedImageUrl,
    animated: resolvedAnimated,
    banner: undefined,
    frame: undefined,
    badge: undefined,
  };
}

// ── Catálogo de cosméticos em cache ────────────────────────────────────
// loja_itens (+ banner/frame/badge) por id. O catálogo só muda pelo painel
// admin (que chama invalidarCatalogoCosmeticos); comprar/equipar muda o
// user_items do usuário, que é sempre lido fresco — então o cache nunca
// mostra um item equipado errado. TTL curto cobre outras instâncias.
const CATALOGO_TTL_MS = 60_000;
type ItemCatalogo = Prisma.ShopItemGetPayload<{ include: { banner: true; frame: true; badge: true } }>;
const catalogoCache = new Map<number, { item: ItemCatalogo | null; expiraEm: number }>();

export function invalidarCatalogoCosmeticos() {
  catalogoCache.clear();
}

async function itensDoCatalogo(ids: number[]): Promise<Map<number, ItemCatalogo>> {
  const agora = Date.now();
  const unicos = [...new Set(ids)];
  const faltando = unicos.filter((id) => (catalogoCache.get(id)?.expiraEm ?? 0) <= agora);
  if (faltando.length > 0) {
    const encontrados = await prisma.shopItem.findMany({
      where: { id: { in: faltando } },
      include: { banner: true, frame: true, badge: true },
    });
    const porId = new Map(encontrados.map((si) => [si.id, si]));
    // Ids inexistentes também ficam em cache (item apagado), para não
    // repetir a busca a cada broadcast.
    for (const id of faltando) catalogoCache.set(id, { item: porId.get(id) ?? null, expiraEm: agora + CATALOGO_TTL_MS });
  }
  const resultado = new Map<number, ItemCatalogo>();
  for (const id of unicos) {
    const item = catalogoCache.get(id)?.item;
    if (item) resultado.set(id, item);
  }
  return resultado;
}

function resolverRefs(refs: UserItemRef[], itemMap: Map<number, ItemCatalogo>) {
  return refs
    .map((ref) => {
      const shopItem = itemMap.get(ref.item_id);
      if (!shopItem) return null;
      const frame = shopItem.frame;
      const badge = shopItem.badge;

      let resolvedValue = shopItem.value;
      if (shopItem.type === "banner" && shopItem.banner) resolvedValue = shopItem.banner.css;
      if (shopItem.type === "frame" && frame) resolvedValue = frame.css ?? frame.imageUrl;

      const resolvedImageUrl = shopItem.type === "badge" && badge ? badge.imageUrl : shopItem.imageUrl;

      return {
        id: shopItem.id,
        name: shopItem.name,
        icon: shopItem.icon,
        value: resolvedValue,
        type: shopItem.type,
        imageUrl: resolvedImageUrl ?? null,
        raridade: shopItem.raridade ?? null,
        animated: shopItem.type === "frame" && frame ? frame.animated : (shopItem.animated ?? false),
        equipped: ref.equipped,
        frameId: shopItem.frameId ?? null,
        frameTipo: shopItem.type === "frame" ? (frame?.tipo ?? null) : null,
        frameAnimated: shopItem.type === "frame" ? (frame?.animated ?? false) : null,
        frameScale: shopItem.type === "frame" ? (frame?.scale ?? 145) : null,
      };
    })
    .filter((i): i is NonNullable<typeof i> => i !== null)
    .sort((a, b) => raridadeWeight(a.raridade as any) - raridadeWeight(b.raridade as any) || a.id - b.id);
}

export const shopRepository = {
  findAvailableItems: async () => {
    const items = await prisma.shopItem.findMany({
      where: { available: true, fragmentavel: false },
      include: { banner: true, frame: true, badge: true },
    });
    items.sort((a, b) => raridadeWeight(a.raridade as any) - raridadeWeight(b.raridade as any) || a.id - b.id);
    return items.map(resolveShopItem);
  },

  findShopItem: (itemId: number) =>
    prisma.shopItem.findUnique({
      where: { id: itemId },
      include: { banner: true, frame: true, badge: true },
    }).then((i) => i ? resolveShopItem(i) : null),

  findUser: (userId: number) =>
    prisma.user.findUnique({ where: { id: userId } }),

  /**
   * Joins user_items refs with ShopItem data.
   */
  resolveUserItems: async (userId: number) => {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { user_items: true } });
    if (!user) return [];
    const refs = parseUserItems(user.user_items);
    return resolverRefs(refs, await itensDoCatalogo(refs.map((r) => r.item_id)));
  },

  /**
   * resolveUserItems para vários usuários de uma vez (ex.: os jogadores de
   * uma sessão a cada broadcast): uma única busca no catálogo para todos,
   * em vez de 1 query de usuário + 4 de catálogo por jogador. Recebe o
   * user_items que a query de origem já trouxe.
   */
  resolveUserItemsEmLote: async (usuarios: { id: number; user_items: unknown }[]) => {
    const refsPorUsuario = new Map(usuarios.map((u) => [u.id, parseUserItems(u.user_items)]));
    const ids = [...refsPorUsuario.values()].flatMap((refs) => refs.map((r) => r.item_id));
    const itemMap = await itensDoCatalogo(ids);
    return new Map([...refsPorUsuario].map(([userId, refs]) => [userId, resolverRefs(refs, itemMap)]));
  },

  saveUserItems: (userId: number, refs: UserItemRef[]) =>
    prisma.user.update({
      where: { id: userId },
      data: { user_items: refs as any },
    }),

  setUserBanner: (userId: number, banner: string | null) =>
    prisma.user.update({ where: { id: userId }, data: { banner } }),

  syncUserBanner: async (userId: number) => {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;

    const refs = parseUserItems(user.user_items);
    const equippedBanner = refs.find((r) => r.equipped);

    if (!equippedBanner) {
      return prisma.user.update({
        where: { id: userId },
        data: { banner: null },
      });
    }

    const shopItem = await prisma.shopItem.findUnique({
      where: { id: equippedBanner.item_id },
      include: { banner: true },
    });

    const banner = equippedBanner.item_id === 0 ? null : (shopItem?.banner?.css ?? shopItem?.value ?? null);

    return prisma.user.update({
      where: { id: userId },
      data: { banner },
    });
  },
};
