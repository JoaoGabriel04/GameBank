# Fix: animação de rolagem acontece DEPOIS da escolha, mesmo quando os dados foram revelados

> Escopo: Modo Tabuleiro, cliente (TurnoModal + Board). Sem mudança de regra, sem mudança de economia.

## 0. Regras de execução (gate de aprovação)
1. **Etapa 1 é somente leitura**: audite e reporte (seção 5). Não escreva nada.
2. Só implemente após aprovação explícita do Gabriel.
3. Se o código real divergir do descrito aqui, pare e reporte.

## 1. O problema (relatado em teste)
- **Às cegas**: jogador escolhe Dado 1 / Dado 2 / Soma → os dados giram → mostra o resultado. **Correto.**
- **Com crédito de visão**: jogador clica em "Revelar" → vê os valores → escolhe uma opção → **os dados giram de novo ("Rolando os dados...")** e só então mostra o resultado. **Errado.** A rolagem visual deveria acontecer no momento da revelação, antes de ele escolher. Depois de escolher, os dados já são conhecidos e não há o que rolar.

## 2. Causa (confirmada no clone de 19/10/2026)
- O servidor já rolou os dados em `dados.service.ts` (`rolar`). `revelarDados` só devolve `dado1/dado2` e consome o crédito. **O backend está correto.**
- No cliente, `client/src/components/Board/TurnoModal/index.tsx`, o `useGSAP` só dispara a animação de giro quando `resultado.escolha != null` (resposta de `escolherMovimento`), sem distinguir se os dados já tinham sido revelados.
- `Board/index.tsx` (`handleRevelarDados`) apenas atualiza `dado1/dado2` no state. Os dados aparecem de imediato, sem animação. O SFX `rolando-dados` (via `onDadosParados`) também só toca depois da escolha.

## 3. Comportamento desejado

### Fluxo às cegas (inalterado)
escolha (dados `?`) → clica → giro + SFX → resultado → desfecho.

### Fluxo com visão (novo)
1. Jogador clica em **Revelar dados**.
2. Os dados `?` **giram** (mesma animação: 360°, 0,3s, 3 repetições) com o texto "Rolando os dados...".
3. Ao parar: mostra os valores, toca o SFX `rolando-dados` (`onDadosParados`), e só então habilita os 3 botões e mostra os destinos de cada opção.
4. Jogador escolhe. **Sem nova animação de giro e sem novo SFX de dados.** Vai direto ao passo de resultado/desfecho já existente (extrato do Início, compra, desfecho).

Regras de implementação:
- Distinguir os dois casos no TurnoModal sem estado frágil. Sugestão: um `ref`/estado `dadosJaRevelados` que vira `true` quando a animação de revelação termina, e que o ramo `resultado.escolha != null` consulta para **pular o giro**. Reiniciar quando um novo turno/rolagem começar.
- Durante o giro da revelação, **botões de escolha desabilitados** e o botão Revelar já em loading (ele já usa `revelandoDados`). Não permitir clicar numa opção antes de os dados pararem.
- A fase "resultado" já existente (1s) deve continuar aparecendo após a escolha com visão, só sem o giro, para o jogador ter o feedback antes do desfecho. Ajustar o tempo se ficar redundante, mas sem deixar a tela "travada".
- Padrão do projeto: toda trava de UI precisa de `finally` + estado visível. Se a requisição de revelar falhar ou demorar (free tier), o modal não pode ficar preso em "rolando".
- GSAP: manter `useGSAP`/timeline como está; matar a timeline no cleanup para não vazar se o modal fechar no meio do giro.

## 4. Bug relacionado (corrigir junto)
Na fase "resultado" o texto mostra sempre `Você tirou {dado1 + dado2}` e `({dado1} + {dado2})`, mesmo quando o jogador escolheu **Dado 1** ou **Dado 2** e andou só aquele valor. Isso confunde.
- Mostrar o que foi **escolhido e quantos passos andou**: ex.: `Você escolheu o Dado 2 e andou 3 casas` (usar `resultado.escolha` e `resultado.passos`, que `movimento.service.ts` já devolve; confirmar que o tipo `RolarDadosResult` expõe `passos`).
- Manter a linha com os dois dados e o aviso "Dados iguais!" quando for duplo (e, se a soma foi escolhida, indicar que ganha jogada extra, como já ocorre).

## 5. ETAPA 1: auditoria (somente leitura)
Reportar:
1. Fluxo atual exato de `useGSAP` no TurnoModal e onde decidir "pular giro" é seguro (inclui reabertura do modal, F5 e alternar compacto/maximizado).
2. O que acontece hoje no **F5 depois de revelar**: o fallback (`Board/index.tsx` ~353-367) reconstrói a tela às cegas, mas o crédito já foi consumido no banco. O jogador perde a visão que pagou e pode clicar em Revelar de novo, gastando outro crédito. Descreva se isso realmente ocorre.
3. Confirmar que `session.service.ts` (~382) continua mascarando `ultimoDado1/2` enquanto `aguardandoEscolha` for true (os dados às cegas **não podem vazar** no payload de `session:updated`). Não alterar esse mascaramento.
4. Pontos onde o SFX `rolando-dados` é disparado, para garantir que toque **uma vez por rolagem**.

Terminar com: "Aguardo aprovação para a Etapa 2".

## 6. ETAPA 2: implementação (após aprovação)
- **Parte A (obrigatória):** seções 3 e 4, só cliente.
- **Parte B (opcional, perguntar ao Gabriel antes):** se o item 2 da auditoria confirmar a perda no F5, tornar a revelação **idempotente** no servidor: guardar na sessão uma flag `dadosRevelados` (reset ao rolar e ao resolver a escolha). `revelarDados` chamado de novo no mesmo turno devolve os dados **sem consumir outro crédito**, e o cliente reconstrói a tela já revelada após F5. Requer migration e testes; manter o mascaramento do item 3.

## 7. Testes
Manual:
- Às cegas: escolher → giro → resultado (igual ao de hoje).
- Com visão: Revelar → giro → valores + destinos → escolher → **sem giro novo**, SFX tocou uma única vez.
- Escolher Dado 1 com visão e às cegas: texto "Você escolheu o Dado 1 e andou N casas".
- Duplo com Soma: aviso de jogada extra continua.
- Clique duplo em Revelar não gasta 2 créditos (já protegido; não regredir).
- Fechar/reabrir o modal e alternar compacto/maximizado durante o giro não trava.
- Timeout de 60s durante o giro não deixa o modal preso.
Se a Parte B for aprovada, Jest: revelar duas vezes no mesmo turno consome 1 crédito; flag reseta na próxima rolagem.

## 8. Definição de pronto
- Com visão, a rolagem acontece ao revelar e nunca depois de escolher.
- SFX de dados uma vez por rolagem.
- Texto do resultado reflete a escolha e os passos.
- Sem regressão no fluxo às cegas, em prisão e em 3 duplos seguidos.
- `make validate` verde.
