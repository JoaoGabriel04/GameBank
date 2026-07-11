// Sons pré-carregados uma vez, reutilizados. Howler já é dependência do
// projeto (ver MusicProvider) — importação dinâmica evita erro de SSR.
import { useSfxStore } from "@/stores/sfxStore"

export type SfxNome =
  | "rolando-dados"
  | "chegou-sua-vez"
  | "comprou-propriedade"
  | "foi-preso"
  | "pagou-aluguel"
  | "tempo-acabando"

const SFX_NOMES: SfxNome[] = [
  "rolando-dados", "chegou-sua-vez", "comprou-propriedade",
  "foi-preso", "pagou-aluguel", "tempo-acabando",
]

// Cache de instâncias Howl (uma por som), carregado sob demanda
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
 * Falha silenciosamente se o áudio não puder tocar (ex: autoplay bloqueado)
 * — som nunca deve quebrar o fluxo do jogo.
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
 * Para um efeito sonoro (útil para sons longos como "tempo-acabando").
 * Falha silenciosamente.
 */
export function stopSfx(nome: SfxNome) {
  try {
    const howl = cache.get(nome)
    if (howl) howl.stop()
  } catch {
    // Silencioso
  }
}

/**
 * Pré-carrega todos os SFX (chamar ao entrar na partida para evitar
 * latência no primeiro toque de cada som).
 */
export async function preloadSfx() {
  try {
    await Promise.all(SFX_NOMES.map(getHowl))
  } catch {
    // Silencioso — preload nunca deve quebrar o fluxo do jogo
  }
}
