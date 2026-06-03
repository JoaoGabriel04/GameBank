# Refatoração: Sistema de Sprites e Banners — GameBank

## Contexto e histórico do problema

O projeto possui um sistema de cosméticos (títulos, emblemas, banners) comprado na loja e equipável pelo usuário. Banners premium possuem um **sprite** — um ícone especial exibido no canto superior direito do banner.

### O bug
O sprite aparece corretamente **apenas** no painel Admin. Em todas as outras partes do app (perfil do usuário, modais de ranking, cards de jogador, etc.), o sprite nunca aparece.

### Causa raiz identificada
Há uma **inconsistência de nomenclatura** entre backend, tipos TypeScript e componentes:

- O backend salva/retorna o ícone do sprite no campo **`icon`** (ex: `"sparkles"`)
- O componente `UserBanner` espera o prop **`spriteId`**
- Os tipos `ShopItem` e `UserItem` têm **`icon?: string | null`** mas também **`spriteId?: string | null`** — campos duplicados e sem contrato claro
- O perfil do usuário autenticado **não retorna `spriteId` nem `icon`** — ambos chegam `null`
- Quando um banner é equipado, o campo de sprite **não é propagado** para o registro do usuário

### Prova dos logs
```
spriteId profile: null
spriteId user: null
resolveSprite result: undefined
equippedBanner: { spriteId: null, icon: "sparkles", equipped: true, ... }
```

O dado existe (`icon: "sparkles"`), mas nunca chega ao componente por estar no campo errado.

---

## Objetivo da refatoração

Padronizar **de ponta a ponta** o campo que representa o sprite de um banner, eliminando a ambiguidade entre `icon` e `spriteId`, e garantir que o sprite apareça em **todos** os lugares do app.

---

## Passo a passo — siga esta ordem, não pule etapas

### ETAPA 1 — Auditoria completa antes de tocar em qualquer código

1. **Buscar todos os usos de `spriteId` no projeto inteiro:**
   ```bash
   grep -rn "spriteId" --include="*.ts" --include="*.tsx" .
   ```

2. **Buscar todos os usos de `icon` relacionados a banners/sprites:**
   ```bash
   grep -rn "\.icon" --include="*.ts" --include="*.tsx" . | grep -i "banner\|sprite\|shop\|item"
   ```

3. **Buscar todos os usos do componente `UserBanner`:**
   ```bash
   grep -rn "<UserBanner" --include="*.tsx" .
   ```

4. **Buscar a função `resolveSprite`:**
   ```bash
   grep -rn "resolveSprite" --include="*.ts" --include="*.tsx" .
   ```
   - Abrir o arquivo onde está definida
   - Confirmar exatamente qual tipo de valor ela espera: slug string (`"sparkles"`), ID numérico, ou outro formato
   - **Documentar o contrato dela antes de continuar**

5. **Localizar no backend:**
   - A rota que retorna o perfil do usuário autenticado
   - A rota/service que processa "equipar item" (`equipShopItemApi`)
   - O model/schema do usuário (Prisma schema, TypeORM entity, etc.)
   - A tabela/model de itens do usuário (`UserItem`)

6. **Montar um mapa** de todos os lugares encontrados antes de alterar qualquer arquivo.

---

### ETAPA 2 — Decidir e documentar o nome canônico do campo

Após a auditoria, escolher **um único nome** para o campo de sprite e usá-lo em todo o projeto. A recomendação é:

**Usar `spriteIcon` como nome canônico** — é descritivo, não conflita com `icon` genérico de outros contextos, e não confunde com `spriteId` (que sugere ser um ID numérico).

> Se após a auditoria você identificar que `icon` ou `spriteId` já é usado consistentemente em 80%+ dos lugares, pode manter esse nome — o importante é que seja **um único nome em todo o projeto**.

Registrar a decisão como comentário no arquivo de tipos antes de prosseguir.

---

### ETAPA 3 — Tipos TypeScript (`src/types/shop.ts` ou equivalente)

Atualizar as interfaces para usar o nome canônico escolhido. Remover o campo duplicado. Exemplo se o nome escolhido for `spriteIcon`:

```typescript
export interface ShopItem {
  id: number
  name: string
  description: string
  price: number
  type: 'title' | 'badge' | 'banner'
  value?: string | null
  available: boolean
  bannerId?: number | null
  /** Slug do sprite exibido no canto do banner (ex: "sparkles"). Apenas banners premium. */
  spriteIcon?: string | null
}

export interface UserItem {
  id: number
  name: string
  description: string
  type: 'title' | 'badge' | 'banner'
  value?: string | null
  equipped: boolean
  /** Slug do sprite exibido no canto do banner (ex: "sparkles"). Apenas banners premium. */
  spriteIcon?: string | null
}
```

Remover `icon` e `spriteId` dos dois interfaces (ou manter como `@deprecated` com alias temporário se o backend ainda não foi atualizado).

---

### ETAPA 4 — Componente `UserBanner`

Atualizar o prop para o nome canônico:

```typescript
type UserBannerProps = {
  banner?: string | null
  spriteIcon?: string | null   // ← nome canônico
  imageUrl?: string | null
  className?: string
}

export default function UserBanner({ banner, spriteIcon, imageUrl, className = "" }: UserBannerProps) {
  // ...lógica do banner...

  const sprite = resolveSprite(spriteIcon)  // ← usa o campo correto
  const SpriteIcon = sprite?.icon

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div className={`absolute inset-0 ${bgClass}`} style={style} />
      {SpriteIcon && (
        <div className="absolute top-2 right-2 z-10 w-7 h-7 rounded-lg bg-zinc-900/70 backdrop-blur-sm border border-white/10 grid place-items-center text-white shadow-sm">
          <SpriteIcon size={15} />
        </div>
      )}
    </div>
  )
}
```

---

### ETAPA 5 — Backend

#### 5a. Schema/Model do usuário
Verificar se o campo de sprite existe no registro do usuário. Se não existir, criar migration:

```prisma
// Exemplo Prisma — adaptar ao ORM usado no projeto
model User {
  // ...campos existentes...
  spriteIcon  String?   // slug do sprite do banner equipado
}
```

#### 5b. Service de "equipar item"
Quando um banner é equipado, salvar o sprite no usuário:

```typescript
// Pseudocódigo — adaptar ao padrão do projeto
async function equipItem(userId: number, itemId: number) {
  const item = await getItem(itemId)
  
  // Desequipa todos os itens do mesmo tipo
  await unequipAllOfType(userId, item.type)
  
  // Equipa o novo
  await setEquipped(userId, itemId, true)
  
  // Se for banner, propaga o sprite para o perfil do usuário
  if (item.type === 'banner') {
    await updateUser(userId, {
      banner: item.value,
      spriteIcon: item.spriteIcon ?? null,  // ← propagar o sprite
    })
  }
}
```

#### 5c. Rota de perfil
Garantir que `spriteIcon` está incluído no payload de resposta do usuário autenticado:

```typescript
// A resposta da rota GET /profile (ou equivalente) deve incluir:
{
  id, nome, level, xp, coins, banner, avatarUrl,
  spriteIcon,   // ← garantir que está aqui
  items: [...],
  // ...
}
```

---

### ETAPA 6 — Todos os usos de `<UserBanner>` no frontend

Para **cada** ocorrência encontrada na auditoria da Etapa 1, atualizar o prop:

```tsx
// Antes (qualquer variação que existia):
<UserBanner banner={x} spriteId={y} />
<UserBanner banner={x} spriteId={item.icon} />
<UserBanner banner={x} />  // sem sprite nenhum

// Depois — sempre passar spriteIcon:
<UserBanner banner={x} spriteIcon={item.spriteIcon} />
```

#### Caso especial — `ProfileHero` em `perfil/page.tsx`
Enquanto o backend não estiver atualizado (ou como camada de segurança extra), usar fallback que busca do item equipado:

```tsx
const equippedBanner = profile.items?.find(
  (i) => i.type === "banner" && i.equipped
)
const resolvedSprite =
  profile.spriteIcon ?? user.spriteIcon ?? equippedBanner?.spriteIcon ?? null

// ...

<UserBanner
  banner={profile.banner ?? user.banner}
  spriteIcon={resolvedSprite}
  className="absolute inset-0 w-full h-full"
/>
```

---

### ETAPA 7 — Inventário (`Inventory` component em `perfil/page.tsx`)

O preview de banner no inventário também deve mostrar o sprite:

```tsx
{item.type === "banner" && item.value && (
  <UserBanner
    banner={item.value}
    spriteIcon={item.spriteIcon}   // ← adicionar
    className="h-10 rounded-lg mb-2 w-full"
  />
)}
```

---

### ETAPA 8 — Verificação de `resolveSprite`

Confirmar que a função aceita o valor que será passado:

```typescript
// Abrir src/constants/sprites.ts (ou onde estiver)
// Verificar se "sparkles" (ou qualquer slug real) está mapeado
// Se a função espera um formato diferente, adaptar os dados, não a função
```

Se `resolveSprite` espera um ID numérico mas o campo armazena slug string (ou vice-versa), isso também é um bug — corrigir o contrato aqui e ajustar os dados no banco se necessário.

---

### ETAPA 9 — Verificar outros contextos que exibem banners

Buscar e corrigir **todos** esses contextos, não apenas o perfil:

- Modal de perfil público (ao clicar em jogador no ranking)
- Cards de jogadores em salas de jogo
- Leaderboard/ranking
- Modal de resultado de partida
- Qualquer outro lugar que renderize banner de usuário

---

### ETAPA 10 — Testes manuais obrigatórios antes de encerrar

- [ ] Usuário com banner premium equipado: sprite aparece na página de perfil
- [ ] Sprite aparece no modal de perfil público (ranking)
- [ ] Preview do banner no inventário mostra o sprite
- [ ] Equip/desequip de banner atualiza o sprite imediatamente (sem reload)
- [ ] Usuário com banner padrão (sem sprite): nenhum ícone aparece — sem erro
- [ ] `resolveSprite(null)` e `resolveSprite(undefined)` retornam `undefined` sem quebrar

---

## O que NÃO fazer

- ❌ Não criar um terceiro campo (ex: `spriteSlug`) — escolha um nome e migre tudo para ele
- ❌ Não usar `item.icon` como gambiarra sem atualizar os tipos — isso é o que criou o bug original
- ❌ Não corrigir só o `ProfileHero` e deixar os outros contextos para depois
- ❌ Não rodar a migration sem verificar se o campo já existe com outro nome
- ❌ Não assumir que o Admin usa o mesmo fluxo do usuário — verificar separadamente por que funciona lá e replicar a lógica

---

## Definição de "pronto"

A tarefa está concluída quando:

1. Existe **um único campo** representando o sprite em tipos, banco, API e componentes
2. `<UserBanner>` recebe e exibe o sprite corretamente em **todos** os contextos do app
3. O perfil do usuário autenticado retorna o sprite na API
4. Equipar um banner propaga o sprite para o usuário no banco
5. Nenhum `console.log` de debug foi deixado no código
6. Nenhum `any`, cast forçado ou comentário `// TODO fix later` foi introduzido para contornar o problema

---

## Resolução aplicada (junho/2026)

A auditoria completa do código revelou que **`spriteId` já é o campo canônico** em 95%+ do projeto (Prisma schema, services, repositories, DTOs, componentes). O bug não era de nomenclatura — era **dado corrompido**.

### Causa raiz

A migration `20260602150749_items_to_json` agregou os items da tabela `usuario_itens` para a coluna JSON em `User.items` **antes** da coluna `User.spriteId` existir (criada em `20260602022000_add_user_sprite_id`). O `jsonb_build_object(...)` da agregação simplesmente **não incluiu o campo `spriteId`**, então todos os items pré-existentes ficaram com `spriteId: null` permanentemente.

A migration `20260603_populate_banner_sprites` corrigiu a tabela `banners` (setou `palette`/`sparkles`/`crown`), mas **não tocou nos items dos usuários**.

### Decisão

- **Manter `spriteId`** como nome canônico (já é o usado em 95%+ do projeto)
- **Não renomear** para `spriteIcon` — risco de regressão sem benefício
- **Não criar** um terceiro campo — `spriteId` é suficiente
- O `icon: "sparkles"` em `ShopItem` é o **ícone FA legado** do item na loja, não tem relação com o sprite do banner
- A cadeia de fallback no client: `profile.spriteId ?? user.spriteId ?? equippedBanner?.spriteId ?? null`

### Correção aplicada

1. **Migration `20260603_sync_user_item_sprites`** — popula `spriteId` no JSON de items e em `User.spriteId` para todos os users legados. Idempotente.
2. **Cleanup** — removidos 4 `console.log` de debug e o fallback errado `?? equippedBanner?.icon` em `perfil/page.tsx`.
3. **Rota admin `POST /api/admin/users/:id/sync-banner`** — re-sincroniza o banner/spriteId de um user específico a partir dos items do JSON. Útil para casos individuais sem rodar migration.

### Quando aplicar migrations de sync no futuro

Ao adicionar um campo novo a `UserItemSnapshot` (ex: novo campo `color?`), é obrigatório criar uma migration de sync que popule o valor nos items pré-existentes. Padrão:

```sql
UPDATE "users" u
SET "items" = (
  SELECT jsonb_agg(
    CASE WHEN (item->>'type') = 'banner' AND (item->>'<novoCampo>') IS NULL
         THEN jsonb_set(item, '{<novoCampo>', to_jsonb(<valor_default>), true)
         ELSE item
    END
  )
  FROM jsonb_array_elements(u.items) item
);
```

### Roteiro para deploy

1. Aplicar em dev primeiro (`make dev-shell SVC=server && npx prisma migrate deploy`)
2. Validar com queries antes/depois (ver `server/prisma/migrations/20260603_sync_user_item_sprites/migration.sql` para as queries de validação)
3. Commitar e pushar → Render re-aplica automaticamente
4. Se aparecer um user inconsistente em produção, usar `POST /api/admin/users/:id/sync-banner`