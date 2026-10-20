# Movimento no GameBank

Guia curto para qualquer pessoa (ou agente) que for mexer em animação. O plano completo está em `docs/animacoes/BOOST_ANIMACOES_GAMEBANK.md`.

## Princípios

1. **Movimento com propósito.** Cada animação explica o que mudou, onde e quanto, ou recompensa o jogador. Nada decorativo que atrase.
2. **Nunca bloqueia o jogo.** Nenhum estado do jogo depende do fim de uma animação. Se uma animação segura a tela, ela tem limite de segurança (`createTimeline({ ... }, { limiteMs })`) e `finally`. O `onComplete` é conveniência, nunca a única saída.
3. **Só `transform` e `opacity`** em animações contínuas. Nada de `width/height/top/left/box-shadow` em loop.
4. **Respeitar o usuário.** Três níveis: completo, reduzido, desligado (ver abaixo).
5. **Sigilo do jogo.** Nenhuma animação antecipa informação oculta: dados às cegas, lances do leilão, item do baú antes do estouro. O peão só anda depois de o servidor confirmar.
6. **Som e imagem juntos.** O SFX toca no momento visual (pouso, impacto), não no clique. Usar `playSfx`, que já respeita volume e mudo.
7. **Sem emojis na interface.** Ícones Lucide/FontAwesome, SVG e CSS.
8. **Orçamento.** 60 fps em celular intermediário (CPU 4x no DevTools); até ~40 partículas no DOM ao mesmo tempo, metade no reduzido; acima disso, canvas.

## Onde fica cada coisa (`client/src/lib/motion/`)

| Arquivo | Conteúdo |
|---|---|
| `tokens.ts` | `duracao` (s) e `duracaoMs`, `curva` (Framer), `curvaGsap`, `mola`, `distancia`, `cascata`, tipo `NivelEfeitos` |
| `variants.ts` | Variantes do Framer: `backdrop`, `modalBox`, `slideUp`, `fadeIn`, `staggerContainer`, `staggerItem`, `pageFade`, `pageSlide`, `popIn`, `pulse`, `shake` |
| `raridade.ts` | `efeitoRaridade(raridade, nivel)` (cor, partículas, raios, intensidade, antecipação, vibração), `melhorRaridade()`, estilos de título |
| `gsap.ts` | Registro único do GSAP (CustomEase, CustomWiggle, curvas `gb-shake`, `gb-tremor`, `gb-pop`, `gb-flash`) e `createTimeline()` |
| `utilitarios.ts` | `animateStaggerIn`, `animateGradientLoop`, `animateProgressBar` (GSAP puro, sem plugins) |
| `prefs.ts` | `useMotionPrefs()`, `useEfeitosStore`, `nivelEfeitosAtual()`, `porNivel()` |

`@/lib/motion` (index) exporta tokens, variantes e raridade, sem GSAP. O resto se importa pelo caminho completo (`@/lib/motion/gsap`, `@/lib/motion/utilitarios`, `@/lib/motion/prefs`): os plugins do GSAP (~5 KB gz) só entram nas páginas que importam `@/lib/motion/gsap`. O antigo `@/lib/animations` foi removido; todos os imports já apontam para `lib/motion`.

## Níveis de efeitos

| Nível | O que acontece |
|---|---|
| `completo` | Tudo |
| `reduzido` | Framer troca movimento por troca imediata (fades continuam), partículas pela metade, shimmer e brilhos em loop param |
| `desligado` | Nenhuma animação decorativa; timelines decorativas terminam na hora (`instantanea: true`) |

- A escolha em Configurações vence.
- Em "Automático", o nível cai para `reduzido` se o sistema pede menos movimento ou se o aparelho parece fraco (até 4 núcleos, até 4 GB ou economia de dados).
- A preferência fica salva só no aparelho.
- O `MotionPrefsProvider` (no layout raiz) publica o nível em `<html data-efeitos>` e configura o `MotionConfig` do Framer. O `globals.css` usa esse atributo para parar as animações CSS decorativas.

## Receitas

**Modal ou sheet (Framer):**
```tsx
import { backdrop, modalBox } from "@/lib/motion";

<AnimatePresence>
  {aberto && (
    <motion.div variants={backdrop} initial="hidden" animate="visible" exit="exit">
      <motion.div variants={modalBox}>...</motion.div>
    </motion.div>
  )}
</AnimatePresence>
```

**Timeline que segura a tela (GSAP):**
```tsx
import { createTimeline, useGSAP } from "@/lib/motion/gsap";
import { useMotionPrefs } from "@/lib/motion/prefs";

const { desligado } = useMotionPrefs();
useGSAP(() => {
  const { tl, dispose } = createTimeline(
    { onComplete: avancar },
    { limiteMs: 3000, instantanea: desligado }
  );
  tl.to(ref.current, { scale: 1.1, duration: 0.3, ease: "gb-pop" });
  return dispose;
}, [fase]);
```

**Partículas por raridade:**
```tsx
import { efeitoRaridade } from "@/lib/motion";
import { useMotionPrefs } from "@/lib/motion/prefs";

const { nivel } = useMotionPrefs();
const efeito = efeitoRaridade(item.raridade, nivel); // efeito.particulas já vem escalado
```

**Pulso de luz com `gb-flash`:** a curva sobe quase na hora e volta a zero sozinha. Anime de 0 até o pico:
```ts
gsap.fromTo(flash, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: "gb-flash" });
```

## Checklist antes de subir uma animação

- Funciona com `prefers-reduced-motion` ligado e com "Desligado" em Configurações?
- Fechar o modal no meio, dar F5 ou cair o socket deixa a UI destravada?
- Revela algo antes da hora?
- Só `transform`/`opacity` no que repete?
- Cleanup: `dispose()`, `ctx.revert()` ou `useGSAP` matam tudo ao desmontar?
