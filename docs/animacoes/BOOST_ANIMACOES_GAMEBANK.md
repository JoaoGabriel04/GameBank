# Boost de animações e sensação de jogo: GameBank

> Objetivo: dar ao jogo **conforto, fluidez e personalidade** sem custar desempenho nem atrapalhar a jogabilidade.
> Escopo: cliente (Modo Tabuleiro, abertura de baús, transições de página, loja, perfil, ranking). Nenhuma regra de jogo, economia ou servidor muda.
> Base: leitura do código de 19/10/2026 (`client/src/lib/animations.ts`, `app/user/(main)/layout.tsx`, `BauAbertura`, `TurnoModal`, `Board`, `globals.css`) e do inventário de Framer Motion do projeto.

---

## 0. Regras de execução (gate de aprovação)
1. **Etapa 1 é somente leitura**: audite e proponha. Não escreva arquivos até a aprovação do Gabriel.
2. Implemente **uma fase por vez**, um commit por item, `make validate` antes de cada push, e revise no celular antes de seguir para a próxima.
3. Se o SkillHub (repo `JoaoGabriel04/SkillHub`) ou outro projeto do Gabriel tiver um kit de animações reaproveitável, **leia e reaproveite os padrões** em vez de reinventar. Reporte o que reaproveitou.
4. Se o código divergir do descrito aqui, pare e reporte.

---

## 1. Estado atual (medido no código)

- **Transição de página**: só existe em `app/user/(main)/layout.tsx`: `AnimatePresence mode="wait"` + `fadeIn` **somente de entrada** (`initial={false}`, sem `exit`). A tela de jogo (`/user/game/[sessionId]`) fica fora disso.
- **Variantes centrais** em `lib/animations.ts`: `backdrop`, `modalBox`, `slideUp`, `fadeIn`, `staggerContainer/staggerItem` (+ utilitários GSAP). Bom ponto de partida.
- **Duas bibliotecas**: Framer Motion (20 arquivos, presença e variantes) e GSAP (9 arquivos, timelines: `BauAbertura`, dados no `TurnoModal`, partículas).
- **Já existe**: partículas de baú (`BauParticulas`), partículas de banner (`BannerParticulas`), keyframes de baú (`bau-suspense`, `bau-sparkle`, `bau-lendario-bg`), shimmer de títulos lendários.
- **Não existe**: suporte a `prefers-reduced-motion` (zero ocorrências), configuração de intensidade de efeitos, animação de movimento do peão passo a passo, indicador de variação de saldo, transição de saída entre páginas, feedback visual de aluguel/compra no tabuleiro.
- Hover dos cards é só Tailwind; sem `whileTap` nos botões.

---

## 2. Princípios (valem para tudo)

1. **Movimento com propósito**: cada animação explica algo (o que mudou, onde, quanto) ou dá recompensa. Nada decorativo que atrase o jogador.
2. **Nunca bloqueia o jogo.** Toda animação é pulável ou dura pouco; **nenhum estado do jogo depende do fim de uma animação**. Lição do projeto (bugs de tela travada no free tier): se uma animação gating falhar, a UI tem de se destravar sozinha. Usar `finally`, timeout de segurança e `onComplete` apenas como conveniência, nunca como única saída.
3. **Só `transform` e `opacity`** nas animações contínuas (GPU). Evitar animar `width/height/top/left/box-shadow` em loop. `will-change` só durante a animação.
4. **Respeitar o usuário**: `prefers-reduced-motion` e uma configuração própria "Efeitos visuais: Completo / Reduzido / Desligado". Em "Reduzido", troca movimento por fade simples e corta partículas.
5. **Nível por aparelho**: detectar aparelho fraco (`navigator.hardwareConcurrency <= 4`, `deviceMemory <= 4`, `saveData`) e cair para "Reduzido" automaticamente na primeira visita (com opção de mudar).
6. **Sigilo do jogo preservado**: nenhuma animação pode antecipar informação oculta (dados às cegas, lances do leilão). O peão **só se move após** o servidor confirmar a escolha.
7. **Som e imagem juntos**: SFX disparam no momento visual (pouso do dado, impacto), nunca no clique. Respeitar volume e mudo existentes.
8. **Sem emojis na interface.** Ícones Lucide/FontAwesome, formas SVG e CSS para partículas e brilhos.
9. **Orçamento**: 60 fps em celular intermediário com CPU 4x mais lenta no DevTools; no máximo ~40 partículas DOM simultâneas (ou canvas para mais), reduzidas pela metade em "Reduzido".

---

## 3. Fases

### Fase 0: Fundação (fazer primeiro)
Criar `client/src/lib/motion/` e migrar o que já existe sem mudar visual:
- **Tokens**: durações (`instant 120ms`, `fast 200ms`, `base 300ms`, `slow 500ms`), curvas (`easeOut`, `easeInOut`, `spring suave`, `spring firme`) e escala de distâncias. Todos os componentes passam a importar daqui.
- **`useMotionPrefs()`**: devolve `{ reduced, nivel: "completo" | "reduzido" | "desligado" }` combinando `prefers-reduced-motion`, configuração do usuário (persistida; `localStorage` só como conveniência, com try/catch) e nível do aparelho.
- **Variantes** existentes reexportadas e ampliadas (`pageSlide`, `pageFade`, `popIn`, `pulse`, `shake`).
- **Registro único do GSAP** e helper `createTimeline()` que mata a timeline no cleanup.
- Regra global em `globals.css`: `@media (prefers-reduced-motion: reduce)` neutraliza as animações decorativas.
- **Configuração** "Efeitos visuais" na tela de Configurações do usuário.
- Documento curto `docs/motion.md` com os princípios acima e exemplos de uso (para qualquer agente que mexer em animação depois).

### Fase 1: Transições entre páginas e navegação
- **Entrada e saída** reais em `(main)/layout.tsx`: saída rápida (≈150ms) + entrada com leve deslocamento (≈10px) e fade. Sem esperar a saída terminar para iniciar a requisição (não pode atrasar a navegação).
- **Direção contextual**: ir para uma página "mais profunda" desliza da direita, voltar desliza da esquerda (mapa de hierarquia de rotas). Entre abas irmãs (barra inferior), só fade/escala sutil.
- **Indicador ativo da navegação** com `layoutId` (a barra/pílula desliza entre itens em vez de trocar de cor).
- **Barra de progresso fina** no topo em mudanças de rota e carregamentos longos (mostra que o app está vivo, importante no free tier lento).
- **Skeletons com shimmer** nas listas (loja, ranking, cofre, sessões) em vez de telas vazias ou spinners soltos.
- **Tela de jogo**: entrada coreografada (tabuleiro, jogadores e HUD em sequência curta, 400ms no máximo); troca entre seções (Visão, Imóveis, Banco, Chat, Ranking) com deslize na direção da aba.
- Avaliar a **View Transitions API** (suportada no Next 16) como melhoria progressiva para transições de elementos compartilhados (ex.: card da loja para detalhe). Só adotar se funcionar bem no Safari iOS; caso contrário ficar com Framer Motion.

### Fase 2: Abertura de baús (a vitrine)
Reestruturar `BauAbertura` (887 linhas) em fases claras, cada uma como timeline GSAP separada e testável:
1. **Antecipação**: o baú treme com intensidade crescente, rachaduras de luz, vinheta escurece o fundo, graves crescentes no áudio. Duração proporcional à raridade do melhor item (já sabida pelo servidor, sem spoiler visual até o estouro).
2. **Estouro**: flash curto, onda de choque, leve camera shake (só transform), raios de luz na **cor da raridade**.
3. **Revelação item a item**: cartas que viram (flip 3D leve) com tratamento por raridade:
   - comum: pop simples;
   - raro: brilho azul e partículas finas;
   - épico: brilho roxo, anel de energia, vibração curta;
   - lendário: tempo extra de suspense (já existe `slideVariantsLendario`), raios dourados, partículas maiores, flash, **vibração do aparelho** (`navigator.vibrate`, com checagem) e SFX próprio.
4. **Resumo**: contagem animada das moedas (count-up), itens em grade com stagger, destaque do melhor item, botões de ação com entrada atrasada.
- **Pular / revelar tudo** sempre disponível (botão e toque duplo), sem perder a recompensa.
- **Segurança**: a recompensa já foi concedida pelo servidor; a animação é só apresentação. Se falhar ou fechar no meio, o resumo continua acessível em Cofre.
- Partículas: reaproveitar `BauParticulas`, com limite por nível de efeitos; avaliar canvas para o estouro.
- Novos SFX necessários (listar para o Gabriel baixar/gerar, mesmo fluxo dos sons atuais): `bau-carregando`, `bau-estouro`, `carta-viro`, `raro`, `epico`, `lendario`, `contagem-moedas`. Todos curtos e comprimidos (ver `OTIMIZACAO_SISTEMA.md`, P2.1).
- Integrar com o plano de **banners lendários** (`BannerParticulas`, `useBannerGlow`), compartilhando o mesmo vocabulário de cores por raridade (definir uma tabela única de cor/efeito por raridade em `lib/motion/raridade.ts`).

### Fase 3: Dentro do jogo (maior impacto no conforto)
Em ordem de valor:
1. **Movimento do peão passo a passo**: em vez de teletransportar, o peão percorre as casas com um pequeno salto por casa, pulso na casa de destino e rastro leve. Duração total limitada (ex.: 120ms por casa, teto de ~900ms; em jogadas longas acelera). **Só começa depois** do servidor confirmar a escolha; interagir com `holdSessionUpdates`/buffer existente sem reintroduzir o bug do peão andando antes do resultado. Peões dos outros jogadores animam igualmente.
2. **Dados**: movimento de rolagem mais físico (giro com desaceleração, quique e sombra), parando exatamente no valor; SFX no pouso. Com visão: a rolagem acontece na revelação (ver `FIX_ROLAGEM_APOS_REVELAR.md`).
3. **Dinheiro**: ao mudar o saldo, número animado (count-up) e **valor flutuante** "+R$ X" (verde) ou "−R$ X" (vermelho) subindo do cartão do jogador. Em aluguel, moedas (ícone SVG, sem emoji) voam do pagador para o dono, no máximo ~1s.
4. **Casas e construção**: ao comprar, flash na cor do dono e "selo" aparece na casa; ao construir, a casa/hotel "cresce" com pop; ao hipotecar, a casa escurece com transição.
5. **Troca de vez**: faixa que varre a tela com o nome do jogador, anel pulsante no avatar da vez; o contador do timer fica urgente nos últimos 10s (pulso discreto + SFX `tempo-acabando` já existente).
6. **Eventos econômicos**: entrada do aviso e da ativação com personalidade pela cor do evento (vermelho/verde), ícone animado; resumo claro, sem poluir.
7. **Leilão**: contagem regressiva em anel, revelação dos lances em sequência dramática (do menor ao maior) com suspense curto.
8. **Falência e vitória**: falência com dessaturação do jogador e propriedades voltando ao banco com animação; pódio final (`PodiumModal`) com confete (já existe), medalhas, contagem de XP e moedas.
9. **Terreno ocioso** (mecânica nova): propriedade ociosa vai ganhando visual "esquecido" (dessaturação gradual, poeira sutil) conforme as rodadas sem visita; ao ser visitada, "reacende". Reforça a regra visualmente sem texto extra.
10. **Chat e notificações**: mensagens entram com deslize, indicador de não lidas com pulso.

### Fase 4: Micro-interações e acabamento
- Botões: `whileTap` (escala 0,97) e feedback de hover só em dispositivos com hover (`@media (hover: hover)`).
- Toasts, modais, bottom sheets: padronizar entrada e saída com os tokens.
- Cards (loja, cofre, ranking): entrada com stagger já existente; adicionar elevação suave no hover/pressão.
- Compra na loja: confirmação com animação de item "indo para o cofre".
- Subida de nível, rank e conquistas: celebração curta e pulável.
- Números (moedas, diamantes, XP): componente `<Contador />` reutilizável com count-up.
- Barras de progresso (XP, rank): já existe `animateProgressBar`; padronizar.
- Estados vazios e erros com ilustração leve e movimento sutil.

### Fase 5: Polimento e medição
- Perfil de desempenho no Chrome DevTools (CPU 4x, celular intermediário): sem quedas abaixo de ~50 fps nas telas de jogo e na abertura de baú.
- Carregamento sob demanda (`next/dynamic`) do `BauAbertura`, `PodiumModal` e dos efeitos pesados, para não aumentar o bundle inicial.
- Garantir que `AnimatePresence` e timelines não vazam (cleanup) e que o modo "Desligado" não executa nenhuma timeline decorativa.
- Revisão de acessibilidade: foco visível e leitura por leitor de tela nos modais animados; `aria-live` para variações de saldo.

---

## 4. ETAPA 1: auditoria e proposta (somente leitura)
Reportar:
1. Mapa de todas as animações existentes (arquivo, biblioteca, o que anima) e o que migrar para `lib/motion/` na Fase 0.
2. Como o peão se move hoje (`Pawns`, `BoardTile`) e como a posição chega do store; proposta de como animar o percurso sem quebrar `holdSessionUpdates`/buffer.
3. Estrutura atual de `BauAbertura` (fases, timelines, dependências do servidor) e proposta de divisão em fases.
4. O que já pode ser reaproveitado de `BauParticulas`, `BannerParticulas`, `LegendaryTitle`.
5. Se houver kit de animações no SkillHub ou outro repo do Gabriel, o que reaproveitar.
6. Lista de SFX novos necessários com duração sugerida.
7. Estimativa de impacto em bundle e em desempenho por fase.
Terminar com: "Aguardo aprovação para a Fase 0".

---

## 5. Verificação a cada fase
- Celular real (Android intermediário) e DevTools com CPU 4x: fluido?
- `prefers-reduced-motion` ligado: sem movimento decorativo.
- Configuração "Desligado": nenhuma timeline decorativa roda.
- Fluxos de jogo (rolar, escolher, comprar, aluguel, leilão, falência) **funcionam igual** com a animação cortada no meio (fechar modal, F5, queda de socket).
- Nenhum dado oculto aparece antes do momento certo.
- `make validate` verde; sem aumento relevante do bundle inicial (medir).

## 6. Definição de pronto
- Sistema de movimento único (`lib/motion/`), com tokens, preferências e documentação.
- Transições de página com entrada e saída; baú com fases e tratamento por raridade; jogo com peão, dado, dinheiro e turno animados.
- Opção de efeitos nos três níveis, funcionando, e detecção automática de aparelho fraco.
- Nenhuma regressão de regras, turno, sigilo dos dados ou travamento de UI.
