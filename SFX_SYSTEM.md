# Implementação: Sistema de Efeitos Sonoros (SFX) — GameBank

## Contexto

Adicionar efeitos sonoros aos eventos do Modo Tabuleiro. O projeto já usa
**Howler.js** para a música de fundo (`MusicProvider` + `musicStore`). Vamos
seguir exatamente esse padrão para os SFX, com um store próprio e persistência
de volume/mute.

**Sons já baixados em `client/public/sounds/`:**
- `rolando-dados.mp3` — ao rolar os dados
- `chegou-sua-vez.mp3` — quando o turno chega ao jogador
- `comprou-propriedade.mp3` — ao comprar propriedade
- `foi-preso.mp3` — ao ser preso
- `pagou-aluguel.mp3` — ao pagar aluguel
- `tempo-acabando.mp3` — quando o contador do turno está acabando

---

## ETAPA 0 — Auditoria

```bash
# Confirmar que os 6 arquivos estão na pasta
ls client/public/sounds/

# Ver o padrão de áudio existente (Howler + musicStore)
cat client/src/components/MusicProvider/index.tsx
cat client/src/stores/musicStore.ts

# Ver o TurnoBanner (onde disparam: vez, rolar dados, tempo)
cat client/src/components/Board/TurnoBanner/index.tsx

# Ver o tipo RolarDadosResult (traz foiPreso, compraDisponivel, etc.)
grep -n "RolarDadosResult\|foiPreso\|aguardandoAcao\|compraDisponivel" \
  client/src/services/api/turno.ts
```

---

## ETAPA 1 — Store de SFX (Zustand + persist)

Criar `client/src/stores/sfxStore.ts` — espelha o `musicStore`:

```typescript
import { create } from "zustand"
import { persist } from "zustand/middleware"

interface SfxStore {
  volume: number      // 0 a 1
  muted: boolean
  setVolume: (v: number) => void
  setMuted: (v: boolean) => void
  toggleMuted: () => void
}

export const useSfxStore = create<SfxStore>()(
  persist(
    (set, get) => ({
      volume: 0.6,          // SFX um pouco mais alto que a música (0.4)
      muted: false,
      setVolume: (volume) => set({ volume }),
      setMuted: (muted) => set({ muted }),
      toggleMuted: () => set({ muted: !get().muted }),
    }),
    { name: "gamebank-sfx" }
  )
)
```

---

## ETAPA 2 — Utilitário de reprodução de SFX

Criar `client/src/utils/sfx.ts` — carrega e toca os sons via Howler.

```typescript
// Sons pré-carregados uma vez, reutilizados. Howler já é dependência.
import { useSfxStore } from "@/stores/sfxStore"

export type SfxNome =
  | "rolando-dados"
  | "chegou-sua-vez"
  | "comprou-propriedade"
  | "foi-preso"
  | "pagou-aluguel"
  | "tempo-acabando"

// Cache de instâncias Howl (uma por som), carregado sob demanda
const cache = new Map<SfxNome, any>()

async function getHowl(nome: SfxNome) {
  if (cache.has(nome)) return cache.get(nome)

  const { Howl } = await import("howler")
  const howl = new Howl({
    src: [`/sounds/${nome}.mp3`],
    volume: useSfxStore.getState().volume,
    preload: true,
  })
  cache.set(nome, howl)
  return howl
}

/**
 * Toca um efeito sonoro. Respeita mute e volume do sfxStore.
 * Falha silenciosamente se o áudio não puder tocar (ex: autoplay bloqueado).
 */
export async function playSfx(nome: SfxNome) {
  try {
    const { muted, volume } = useSfxStore.getState()
    if (muted || volume <= 0) return

    const howl = await getHowl(nome)
    howl.volume(volume)
    howl.play()
  } catch {
    // Silencioso — som nunca deve quebrar o fluxo do jogo
  }
}

/**
 * Pré-carrega todos os SFX (chamar ao entrar na partida para evitar
 * latência no primeiro toque de cada som).
 */
export async function preloadSfx() {
  const nomes: SfxNome[] = [
    "rolando-dados", "chegou-sua-vez", "comprou-propriedade",
    "foi-preso", "pagou-aluguel", "tempo-acabando",
  ]
  await Promise.all(nomes.map(getHowl))
}
```

**Nota sobre autoplay:** navegadores bloqueiam áudio antes da primeira
interação do usuário. Como os SFX disparam a partir de ações (rolar dados,
etc.), isso não é problema — quando o primeiro som toca, o usuário já
interagiu. O `try/catch` cobre o resto.

---

## ETAPA 3 — Disparar os sons nos eventos certos

### 3.1 — `rolando-dados` e `foi-preso` (TurnoBanner)

Em `client/src/components/Board/TurnoBanner/index.tsx`, dentro de
`handleRolarDados`, após receber o resultado:

```typescript
import { playSfx } from "@/utils/sfx"

const handleRolarDados = async () => {
  if (rolando) return
  setDado1(undefined)
  setDado2(undefined)
  setRolando(true)
  setDadosAberto(true)

  playSfx("rolando-dados")   // ← som ao iniciar a rolagem

  try {
    const r = await rolarDados(session.id)
    if (!r) { setDadosAberto(false); return }

    if (r.falido) {
      setDadosAberto(false)
      toastError(r.mensagem ?? "Você faliu...")
      return
    }

    setDado1(r.dado1)
    setDado2(r.dado2)

    if (r.foiPreso) {
      playSfx("foi-preso")   // ← som ao ser preso (3 duplos)
      toastInfo(`Deu ${r.dado1} e ${r.dado2} — 3 duplos seguidos! Direto pra prisão.`)
    } else {
      // ...toasts existentes...
    }
  } catch (err: any) {
    // ...
  } finally {
    setRolando(false)
  }
}
```

### 3.2 — `comprou-propriedade` e `pagou-aluguel`

Estes dependem do desfecho da casa. O `RolarDadosResult` traz os campos
necessários. Após o `rolarDados` retornar, verificar o que aconteceu:

```typescript
// Ainda em handleRolarDados, no bloco de sucesso (não preso):

// Aluguel pago automaticamente ao cair em propriedade de outro:
// (o backend já processa; detectar pela mensagem ou por um campo)
// Se o RolarDadosResult tiver um campo indicando aluguel pago, usar ele.
// Caso o backend sinalize via mensagem, seguir o padrão existente.

// Para a COMPRA: o som toca quando o jogador confirma a compra,
// não ao cair na casa. Ver 3.3 abaixo.
```

**Importante:** o som de `pagou-aluguel` deve tocar quando o aluguel é
efetivamente cobrado. Como o backend processa isso no `rolarDados`, e já
existe o evento `aluguel:toast` no socket, o ideal é tocar o som no
**listener do socket** que já trata o aluguel:

```typescript
// Em client/src/stores/socketStore.ts, no listener aluguel:toast:
import { playSfx } from "@/utils/sfx"

socket.on("aluguel:toast", (data) => {
  // ...lógica existente de toast...
  // Tocar som apenas para quem pagou (ou para todos, conforme preferência)
  playSfx("pagou-aluguel")
})
```

### 3.3 — `comprou-propriedade` (no modal de compra)

O som toca quando o jogador confirma a compra. No componente que trata a
compra (CompraCasaModal ou o TurnoModal unificado, dependendo de qual está
ativo):

```typescript
import { playSfx } from "@/utils/sfx"

async function handleComprar() {
  try {
    await comprarCasaAtual(sessionId)
    playSfx("comprou-propriedade")   // ← som ao confirmar compra
  } catch (err) {
    // ...
  }
}
```

### 3.4 — `chegou-sua-vez` (quando o turno chega ao jogador)

No `TurnoBanner`, detectar a transição para a vez do jogador via `useEffect`:

```typescript
import { useRef } from "react"
import { playSfx } from "@/utils/sfx"

// Guardar a vez anterior para detectar a transição
const vezAnteriorRef = useRef<number | null>(null)

useEffect(() => {
  const eraMinhaVez = vezAnteriorRef.current === meuPlayerId
  const agoraMinhaVez = session.turnoAtualPlayerId === meuPlayerId

  // Tocar só na transição (não era minha vez → agora é)
  if (!eraMinhaVez && agoraMinhaVez && meuPlayerId) {
    playSfx("chegou-sua-vez")
  }

  vezAnteriorRef.current = session.turnoAtualPlayerId ?? null
}, [session.turnoAtualPlayerId, meuPlayerId])
```

### 3.5 — `tempo-acabando` (contador do turno)

No `useEffect` do timer do `TurnoBanner`, tocar quando restar pouco tempo,
uma única vez:

```typescript
const alertouTempoRef = useRef(false)

useEffect(() => {
  if (!session.turnoIniciadoEm) return
  const inicio = new Date(session.turnoIniciadoEm).getTime()

  const tick = () => {
    const passado = Math.floor((Date.now() - inicio) / 1000)
    const restanteS = Math.max(0, TURNO_TIMEOUT_S - passado)
    setRestante(restanteS)

    // Tocar "tempo acabando" quando faltam 10s, só uma vez, só na minha vez
    const minhaVez = session.turnoAtualPlayerId === meuPlayerId
    if (minhaVez && restanteS === 10 && !alertouTempoRef.current) {
      playSfx("tempo-acabando")
      alertouTempoRef.current = true
    }
  }

  tick()
  const id = setInterval(tick, 1000)
  return () => clearInterval(id)
}, [session.turnoIniciadoEm, session.turnoAtualPlayerId, meuPlayerId])

// Resetar o flag quando a vez muda
useEffect(() => {
  alertouTempoRef.current = false
}, [session.turnoAtualPlayerId])
```

---

## ETAPA 4 — Pré-carregar ao entrar na partida

Na página de jogo (`client/src/app/user/game/[sessionId]/page.tsx`),
pré-carregar os sons ao montar:

```typescript
import { useEffect } from "react"
import { preloadSfx } from "@/utils/sfx"

useEffect(() => {
  preloadSfx()
}, [])
```

---

## ETAPA 5 — Controle de volume/mute nas configurações

O usuário precisa poder mutar/ajustar os SFX. Adicionar controle onde já
existe o controle de música (procurar pela UI do `musicStore`):

```bash
grep -rn "musicStore\|useMusicStore\|volume\|togglePlaying" \
  client/src --include="*.tsx" | grep -v node_modules | grep -i "config\|setting\|menu"
```

Adicionar um slider/toggle para SFX espelhando o de música:

```tsx
import { useSfxStore } from "@/stores/sfxStore"

const { volume, muted, setVolume, toggleMuted } = useSfxStore()

// Slider de volume dos efeitos + botão de mute
<div className="flex items-center gap-2">
  <button onClick={toggleMuted}>
    {muted ? "🔇" : "🔊"} Efeitos
  </button>
  <input
    type="range" min={0} max={1} step={0.1}
    value={volume}
    onChange={e => setVolume(Number(e.target.value))}
    disabled={muted}
  />
</div>
```

---

## ETAPA 6 — Testes manuais

- [ ] Rolar dados toca `rolando-dados`
- [ ] Ser preso (3 duplos ou Vá para Detenção) toca `foi-preso`
- [ ] Comprar propriedade toca `comprou-propriedade`
- [ ] Pagar aluguel toca `pagou-aluguel`
- [ ] Quando o turno chega ao jogador, toca `chegou-sua-vez`
- [ ] Faltando 10s no turno, toca `tempo-acabando` (uma vez só)
- [ ] `tempo-acabando` NÃO toca de novo no mesmo turno
- [ ] `chegou-sua-vez` só toca na transição (não repete)
- [ ] Mutar SFX silencia todos os efeitos (música continua)
- [ ] Slider de volume ajusta o volume dos efeitos
- [ ] Volume/mute persistem ao recarregar a página
- [ ] Sons não quebram o jogo se falharem (autoplay bloqueado, etc.)
- [ ] Sons não tocam duas vezes por evento
- [ ] `make validate` passa

---

## Definição de "pronto"

1. `sfxStore.ts` com volume/mute persistidos
2. `sfx.ts` com `playSfx` e `preloadSfx` via Howler
3. Os 6 sons disparando nos eventos corretos
4. `tempo-acabando` e `chegou-sua-vez` com guarda anti-repetição
5. Controle de volume/mute na UI de configurações
6. Preload ao entrar na partida
7. Todos os testes manuais passando

---

## Notas importantes

- **Reutiliza Howler**, que já é dependência do projeto (via MusicProvider).
  Não adicionar nova biblioteca de áudio.
- **Falha silenciosa**: som nunca deve interromper o jogo. Todo `playSfx`
  é envolvido em try/catch.
- **Anti-repetição**: `chegou-sua-vez` e `tempo-acabando` usam refs de
  controle para não disparar múltiplas vezes no mesmo turno.
- **Não altera backend**: todos os sons são disparados no cliente, a partir
  de estados que já chegam via socket/API.
