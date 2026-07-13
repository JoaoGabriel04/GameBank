# Correção: Compra Travada e Sem Feedback de Loading

## Sintomas relatados

1. Ao rolar os dados, **o botão "Comprar" não aparece** — a tela "pula" direto
   para o banner de decisão pendente
2. O jogador clica em **"Decidir agora" e nada acontece** — precisa dar F5
3. Ao clicar em **"Comprar", não há sinal de carregamento** — o jogador não
   sabe se a compra está processando

**Agravante:** o relógio do turno continua correndo durante tudo isso. O
jogador **perde a vez** por causa de bugs de interface.

---

## Diagnóstico — três bugs, duas raízes

Todos em `client/src/components/Board/index.tsx`.

---

# BUG 1 — `decidindoRef` trava e engole os cliques 🔴 CRÍTICO

## Causa

```typescript
const decidindoRef = useRef(false)

const handleComprar = useCallback(async () => {
  if (decidindoRef.current || !resultadoModal?.compraDisponivel) return  // ← sai em silêncio
  decidindoRef.current = true
  try {
    const ok = await comprarCasaAtual(session.id)
    // ...
  } finally {
    decidindoRef.current = false   // ← só roda SE a promise resolver
  }
}, [...])
```

`decidindoRef` é uma trava anti-clique-duplo. O problema:

**Se a promise `comprarCasaAtual` nunca resolver nem rejeitar, o `finally`
nunca executa.** No free tier (Render), o servidor hiberna e requisições ficam
penduradas indefinidamente — sem resposta, sem erro.

Resultado: `decidindoRef.current` fica `true` **para sempre**. Todo clique
seguinte cai no `return` inicial e é **ignorado silenciosamente**.

O jogador clica, clica, clica — e nada acontece. Só o F5 resolve (o ref é
recriado no mount).

O mesmo vale para `handleRecusar`, que usa a mesma trava.

---

# BUG 2 — Sem feedback de loading 🟡

## Causa

`decidindoRef` é um **`useRef`**. Refs **não causam re-render**.

Não existe nenhum estado que a UI possa observar para saber que a compra está
em andamento. Por isso não há como mostrar "Comprando...", spinner ou botão
desabilitado.

**É a mesma raiz do BUG 1** — e a correção é a mesma: trocar o ref por state.

---

# BUG 3 — O modal não abre quando a resposta demora 🔴

## Causa

No fallback que reconstrói a compra pendente a partir do estado do servidor
(~linha 380):

```typescript
// BUG (decidir-depois some ao voltar de aba): [...] Em vez disso,
// respeita o estado local (`modalAberto`, false no primeiro mount)
modalAbertoFinal = modalAberto     // ← false no primeiro mount!
faseInicialModal = "acao"
```

A intenção é correta: **não reabrir** o modal se o jogador clicou "Decidir
depois". Mas o código **não distingue dois casos diferentes**:

| Caso | O que deveria acontecer |
|---|---|
| O jogador **minimizou** ("Decidir depois") | Manter minimizado ✓ |
| O `resultado` local **nunca chegou** (servidor lento) | **Abrir o modal** ✗ |

Hoje ambos caem no mesmo caminho: modal fechado, só o banner.

### O cenário completo

1. Jogador rola os dados
2. Servidor lento — a resposta de `rolarDados()` demora (ou fica pendurada)
3. O `session:updated` chega **antes** pelo socket, com `aguardandoAcao: true`
4. O fallback reconstrói `resultadoModal` — mas `modalAberto` é `false`
5. **O modal não abre.** Só aparece o banner "Compra pendente — Decidir agora"
6. O jogador clica em "Decidir agora"
7. Se o `decidindoRef` já estiver travado (BUG 1) → **nada acontece**

---

## CORREÇÃO

### 1 — Trocar `decidindoRef` por state (resolve BUGs 1 e 2)

```typescript
// Antes:
// const decidindoRef = useRef(false)

// Depois — state, para a UI poder reagir:
type AcaoCompra = "comprando" | "recusando" | null
const [acaoEmCurso, setAcaoEmCurso] = useState<AcaoCompra>(null)
```

### 2 — Timeout de segurança nas chamadas

Nunca deixar uma promise pendurada travar a UI. Envolver com um limite de tempo:

```typescript
// client/src/utils/withTimeout.ts
export function withTimeout<T>(promise: Promise<T>, ms = 15000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("TIMEOUT")), ms)
    ),
  ])
}
```

```typescript
const handleComprar = useCallback(async () => {
  if (acaoEmCurso || !resultadoModal?.compraDisponivel) return

  const nome = resultadoModal.compraDisponivel.nome
  setAcaoEmCurso("comprando")
  setErroCompra(null)

  try {
    const ok = await withTimeout(comprarCasaAtual(session.id), 15000)
    if (ok) {
      setModalAberto(false)
      setErroCompra(null)
      playSfx("comprou-propriedade")
      toastSuccess(`Você comprou ${nome}!`)
    } else {
      const storeError = useGameStore.getState().error
      if (storeError?.toLowerCase().includes("saldo")) {
        setErroCompra("Saldo insuficiente! Vá até a aba Início para vender casas ou hipotecar imóveis, depois volte e tente novamente.")
      } else {
        setErroCompra(storeError || "Não foi possível concluir a compra.")
      }
    }
  } catch (err: any) {
    if (err?.message === "TIMEOUT") {
      setErroCompra("O servidor está demorando a responder. Tente novamente.")
    } else {
      setErroCompra("Erro ao comprar. Tente novamente.")
    }
  } finally {
    setAcaoEmCurso(null)   // ← SEMPRE destrava, inclusive no timeout
  }
}, [acaoEmCurso, resultadoModal, comprarCasaAtual, session.id, toastSuccess])
```

Aplicar o mesmo padrão em `handleRecusar` (`setAcaoEmCurso("recusando")`).

### 3 — Feedback visual nos botões (resolve BUG 2)

Passar o estado para o `TurnoModal` e refletir na UI:

```tsx
<TurnoModal
  // ...props existentes...
  acaoEmCurso={acaoEmCurso}
  onComprar={handleComprar}
  onRecusar={handleRecusar}
/>
```

Dentro do `TurnoModal`, na fase `"acao"`:

```tsx
<button
  onClick={onComprar}
  disabled={acaoEmCurso !== null}
  className="... disabled:opacity-60 disabled:cursor-not-allowed"
>
  {acaoEmCurso === "comprando" ? (
    <span className="flex items-center gap-2">
      <Spinner className="w-4 h-4 animate-spin" />
      Comprando...
    </span>
  ) : (
    `Comprar por R$ ${preco.toLocaleString("pt-BR")}`
  )}
</button>

<button
  onClick={onRecusar}
  disabled={acaoEmCurso !== null}
  className="... disabled:opacity-60"
>
  {acaoEmCurso === "recusando" ? "Recusando..." : "Recusar"}
</button>
```

**Ambos os botões ficam desabilitados** enquanto qualquer ação está em curso —
isso substitui a trava do ref, mas de forma **visível** para o jogador.

### 4 — Distinguir "minimizado" de "nunca abriu" (resolve BUG 3)

O fallback precisa saber se o jogador **realmente** minimizou o modal, ou se
ele nunca chegou a abrir.

```typescript
// Novo ref: marca que o jogador minimizou DELIBERADAMENTE
const minimizouManualmenteRef = useRef(false)

// No handler do botão "Decidir depois" do TurnoModal:
const handleDecidirDepois = useCallback(() => {
  minimizouManualmenteRef.current = true
  setModalAberto(false)
}, [])

// Ao abrir uma nova decisão (nova rolagem), resetar:
// (em handleRolarDados, junto com setResultado)
minimizouManualmenteRef.current = false
```

E no fallback:

```typescript
// ANTES:
// modalAbertoFinal = modalAberto

// DEPOIS: abre o modal, a menos que o jogador tenha minimizado de propósito
modalAbertoFinal = modalAberto || !minimizouManualmenteRef.current
faseInicialModal = "acao"
```

Assim:
- Jogador clicou "Decidir depois" → fica minimizado ✓
- Resultado nunca chegou (servidor lento) → **o modal abre** ✓
- Trocou de aba e voltou, já tendo minimizado → continua minimizado ✓

**Resetar `minimizouManualmenteRef` quando a compra pendente muda de
propriedade** (o jogador caiu numa casa nova — é uma decisão nova):

```typescript
useEffect(() => {
  minimizouManualmenteRef.current = false
}, [resultadoModal?.compraDisponivel?.propId])
```

---

## TESTES OBRIGATÓRIOS

### Bug 1 — clique engolido
- [ ] Clicar "Comprar" com o servidor lento (simular 10s) → o botão mostra
      "Comprando..." e destrava ao terminar
- [ ] Simular servidor pendurado (>15s) → o timeout dispara, mostra erro e
      **destrava o botão**
- [ ] Após o timeout, clicar de novo **funciona** (não fica travado)
- [ ] Clicar "Recusar" com servidor lento → mesmo comportamento
- [ ] Clique duplo rápido → só uma requisição é enviada

### Bug 2 — feedback de loading
- [ ] Ao clicar "Comprar", o botão mostra spinner + "Comprando..."
- [ ] Ambos os botões (Comprar e Recusar) ficam desabilitados durante a ação
- [ ] Ao terminar, os botões voltam ao normal
- [ ] Em caso de erro, a mensagem aparece e os botões destravam

### Bug 3 — modal não abre
- [ ] Rolar dados com servidor lento → **o modal de compra abre sozinho**
      quando o estado chega pelo socket (não fica só o banner)
- [ ] Clicar "Decidir depois" → o modal minimiza e **fica** minimizado
- [ ] Trocar de aba e voltar, tendo minimizado → continua minimizado
- [ ] Cair numa nova propriedade → o modal abre normalmente (o "minimizei
      antes" não persiste entre decisões diferentes)
- [ ] Clicar no banner "Decidir agora" → o modal abre

### Não quebrou nada
- [ ] Compra normal (servidor rápido) funciona como antes
- [ ] Recusa dispara o leilão normalmente
- [ ] Saldo insuficiente mostra a mensagem correta
- [ ] A ordem das informações (dados → peão → desfecho) continua correta
- [ ] `make validate` passa

---

## Definição de "pronto"

1. `decidindoRef` substituído por `acaoEmCurso` (state)
2. `withTimeout` de 15s em `comprarCasaAtual` e `recusarCompra`
3. `finally` sempre destrava — inclusive no timeout
4. Botões com spinner, texto de estado e `disabled` durante a ação
5. `minimizouManualmenteRef` distingue "minimizei" de "nunca abriu"
6. O modal abre sozinho quando o resultado chega só pelo socket
7. Todos os testes passando

---

## Nota — o padrão que se repete

Este é o **terceiro bug** causado por uma trava que depende de uma promise
resolver (`holdSessionUpdates`, `decidindoRef`, e agora este).

**A lição:** num servidor que hiberna, *nenhuma* promise pode ser tratada como
garantida. Toda trava de UI precisa de:

1. **`finally`** — libera em qualquer desfecho
2. **Timeout** — a promise pode nunca resolver
3. **Estado visível** — o jogador precisa ver que algo está em curso

Vale auditar o resto do código em busca de outras travas com o mesmo padrão:

```bash
grep -rn "useRef(false)" client/src --include="*.tsx" | grep -v node_modules
```

Qualquer ref booleano que trava ações e só destrava dentro de um `try` é
candidato ao mesmo bug.
