# Instruções de Integração — Páginas de Usuário

> **Para o Claude Code:** Leia este documento integralmente antes de executar qualquer ação. Siga cada fase na ordem indicada. Não pule etapas.

---

## Contexto

Foram criadas novas páginas de usuário (TSX) com dados mockados. O objetivo agora é:

1. Mapear todos os dados fictícios usados nessas páginas.
2. Criar as rotas, services e repositórios necessários no **backend**.
3. Criar os services, hooks e tipos necessários no **frontend**.
4. Substituir todos os mocks por dados reais vindos do servidor.
5. Garantir tipagem consistente de ponta a ponta (backend → frontend).

---

## Regras Absolutas — Leia antes de tudo

- **Nunca** crie arquivos fora dos diretórios canônicos da arquitetura já existente.
- **Nunca** apague arquivos existentes sem antes confirmar que nenhuma outra parte do projeto os referencia.
- **Nunca** altere arquivos de infraestrutura (configuração de banco, seed, migrations já consolidadas, arquivos de env) sem necessidade explícita.
- **Nunca** duplique lógica já existente — reutilize services, repos e hooks existentes sempre que possível.
- **Sempre** inferir o padrão arquitetural lendo os arquivos já existentes de cada camada antes de criar algo novo.
- **Sempre** manter consistência de nomenclatura com o que já existe no projeto (camelCase, PascalCase, snake_case — o que já está em uso).
- **Sempre** tipar explicitamente: sem `any`, sem `unknown` desnecessário, sem tipos inline quando já existe uma interface/type reutilizável.
- Em caso de dúvida sobre onde um arquivo deve morar, **leia o `AGENTS.md`** e o diretório pai correspondente antes de decidir.

---

## Fase 1 — Leitura e Mapeamento (somente leitura, zero escrita)

### 1.1 — Leia o AGENTS.md

```
Leia o arquivo AGENTS.md na raiz do projeto (e qualquer outro arquivo de convenções/arquitetura referenciado nele).
Extraia e memorize:
- Estrutura de diretórios do backend (onde ficam: rotas, controllers, services, repositórios, tipos/DTOs, middlewares).
- Estrutura de diretórios do frontend (onde ficam: pages, components, hooks, services/api, tipos, utils).
- Convenções de nomenclatura de arquivos e funções.
- Padrão de resposta da API (envelope de resposta, paginação, erros).
- Padrão de autenticação (header, token, middleware).
```

### 1.2 — Leia as novas páginas TSX criadas

```
Para cada página nova de usuário (TSX):
1. Liste todos os dados que estão hardcoded/mockados (arrays literais, objetos estáticos, strings fixas que deveriam ser dinâmicas).
2. Liste todas as ações do usuário que precisam chamar o backend (submits, deletes, updates, fetches).
3. Liste os tipos/interfaces que foram definidos inline ou que estão ausentes.
4. Identifique quais hooks, services ou chamadas de API já existem no frontend que poderiam ser reutilizados.
```

### 1.3 — Leia o backend existente

```
Para cada entidade/recurso identificado no passo 1.2:
1. Verifique se já existe uma rota correspondente.
2. Verifique se já existe um service correspondente.
3. Verifique se já existe um repositório correspondente.
4. Verifique se já existem DTOs/tipos correspondentes.
Documente o que existe e o que precisa ser criado.
```

### 1.4 — Leia o frontend existente (services/api/hooks)

```
1. Liste todos os arquivos em services/ (ou api/) do frontend.
2. Liste todos os hooks customizados existentes.
3. Liste todos os tipos/interfaces existentes.
Identifique o que pode ser reutilizado ou estendido.
```

### 1.5 — Produza um plano de trabalho

```
Antes de escrever qualquer linha de código, gere um relatório no seguinte formato:

## RELATÓRIO DE LACUNAS

### Backend — O que precisa ser criado:
- [ ] Rota: METHOD /caminho — descrição
- [ ] Service: NomeService#metodo — descrição
- [ ] Repositório: NomeRepo#metodo — descrição
- [ ] DTO/Tipo: NomeDTO — campos

### Frontend — O que precisa ser criado/alterado:
- [ ] Tipo/Interface: NomeTipo — campos
- [ ] Service/API call: nomeServico — endpoint que chama
- [ ] Hook: useNomeHook — o que gerencia
- [ ] Página TSX: NomePagina — mocks a substituir

### Reutilizações identificadas:
- ServiceX#metodoY já cobre o caso Z, será reutilizado.
- HookW já faz fetch de W, será estendido com parâmetro X.

Aguarde confirmação antes de prosseguir para a Fase 2.
```

> ⚠️ **Pause aqui.** Apresente o relatório acima ao usuário e aguarde aprovação explícita antes de executar qualquer escrita.

---

## Fase 2 — Implementação no Backend

> Execute somente após aprovação do relatório da Fase 1.

### 2.1 — Tipos e DTOs

```
Para cada DTO/tipo novo identificado:
1. Crie no diretório canônico de tipos do backend (conforme AGENTS.md).
2. Nomeie seguindo a convenção existente.
3. Use os tipos primitivos corretos — não use `any`.
4. Se um DTO de resposta já existe e só precisa de novos campos, ESTENDA-o, não duplique.
```

### 2.2 — Repositórios

```
Para cada método de repositório novo:
1. Verifique se o repositório da entidade já existe.
   - Se sim: adicione apenas o novo método no arquivo existente.
   - Se não: crie o arquivo no diretório canônico de repositórios.
2. O método deve receber parâmetros tipados e retornar tipos explícitos.
3. Não repita queries já existentes em outros repositórios — reutilize ou extraia para um helper se necessário.
```

### 2.3 — Services

```
Para cada método de service novo:
1. Verifique se o service da entidade já existe.
   - Se sim: adicione apenas o novo método.
   - Se não: crie no diretório canônico de services.
2. O service deve depender do repositório (injeção ou instância, conforme o padrão do projeto).
3. Valide entradas, trate erros, e retorne o tipo correto.
4. Não acesse o banco diretamente no service — delegue ao repositório.
```

### 2.4 — Controllers/Handlers de Rota

```
Para cada rota nova:
1. Identifique o arquivo de rotas correto (por entidade ou por domínio, conforme AGENTS.md).
2. Adicione o handler no controller correspondente (ou crie se não existir).
3. Aplique os middlewares necessários (autenticação, validação) seguindo o padrão das rotas existentes.
4. O handler deve: receber request tipada → chamar service → retornar resposta no envelope padrão do projeto.
5. Registre a rota no arquivo de registro de rotas (se o projeto tiver um router central).
```

### 2.5 — Validação de consistência do backend

```
Após criar todos os artefatos do backend:
1. Confirme que cada nova rota está registrada.
2. Confirme que os tipos de retorno dos services batem com os DTOs de resposta.
3. Confirme que não há imports quebrados.
4. Se o projeto tiver testes, verifique se os novos services precisam de teste unitário e crie os mínimos necessários.
```

---

## Fase 3 — Implementação no Frontend

> Execute somente após concluir e validar a Fase 2.

### 3.1 — Tipos e Interfaces

```
Para cada tipo/interface novo no frontend:
1. Crie no diretório canônico de tipos do frontend (conforme AGENTS.md).
2. Os tipos devem espelhar os DTOs de resposta do backend — não invente campos que o backend não retorna.
3. Se um tipo já existe e só precisa de extensão, use `extends` ou `&` — não duplique.
4. Exporte cada tipo corretamente para ser reutilizável.
```

### 3.2 — Services / Chamadas de API

```
Para cada nova chamada de API:
1. Verifique se já existe um service para a entidade/domínio.
   - Se sim: adicione o novo método no arquivo existente.
   - Se não: crie no diretório canônico de services/api do frontend.
2. Use o cliente HTTP já configurado no projeto (axios instance, fetch wrapper, etc.) — não crie um novo.
3. Tipar: parâmetros de entrada e retorno explícitos, usando os tipos criados no passo 3.1.
4. Trate erros seguindo o padrão dos outros services (throw, return null, etc.).
```

### 3.3 — Hooks Customizados

```
Para cada hook novo:
1. Verifique se um hook existente pode ser reutilizado ou levemente adaptado.
2. Crie no diretório canônico de hooks (conforme AGENTS.md).
3. O hook deve: chamar o service → gerenciar estado (loading, error, data) → retornar interface estável.
4. Use o gerenciador de estado/fetching já adotado no projeto (React Query, SWR, useState+useEffect, Zustand, etc.) — não misture padrões.
5. Não coloque lógica de negócio nos hooks — apenas orquestração de estado e chamada ao service.
```

### 3.4 — Substituição dos Mocks nas Páginas TSX

```
Para cada página TSX com dados mockados:
1. Importe os hooks criados no passo 3.3.
2. Substitua cada variável mockada pelo dado real retornado pelo hook.
3. Adicione estados de loading (skeleton, spinner — o que o projeto já usa).
4. Adicione tratamento de erro (toast, mensagem inline — o que o projeto já usa).
5. Substitua cada handler de ação mockado (ex: onSave, onDelete) pela chamada real ao service/hook de mutação.
6. Remova todos os imports de dados mockados que não são mais necessários.
7. Remova todos os arquivos de mock que não têm mais referências no projeto (verifique antes de apagar).
```

### 3.5 — Validação de consistência do frontend

```
Após concluir todas as substituições:
1. Confirme que nenhuma página ainda usa dados hardcoded que deveriam ser dinâmicos.
2. Confirme que não há imports não utilizados em nenhum dos arquivos alterados.
3. Confirme que os tipos de props de todos os componentes alterados estão corretos.
4. Confirme que nenhum `any` foi introduzido.
5. Se o projeto usa um linter/type-check, rode-o e corrija todos os erros antes de encerrar.
```

---

## Fase 4 — Revisão Final

```
Produza um relatório final no seguinte formato:

## RELATÓRIO DE INTEGRAÇÃO CONCLUÍDA

### Arquivos criados no backend:
- caminho/do/arquivo — o que faz

### Arquivos alterados no backend:
- caminho/do/arquivo — o que foi adicionado/modificado

### Arquivos criados no frontend:
- caminho/do/arquivo — o que faz

### Arquivos alterados no frontend:
- caminho/do/arquivo — o que foi substituído/adicionado

### Arquivos removidos:
- caminho/do/arquivo — motivo

### Mocks eliminados:
- NomePagina.tsx: variável `X` substituída por hook `useY`
- NomePagina.tsx: handler `onZ` substituído por mutação `useZMutation`

### Pendências ou decisões tomadas:
- Descreva qualquer ponto que exigiu interpretação ou que pode precisar de revisão humana.
```

---

## Checklist Rápido — Anti-Regressão

Antes de encerrar, confirme cada item:

- [ ] Nenhum dado hardcoded permanece nas páginas de usuário
- [ ] Nenhum import está quebrado em nenhum arquivo tocado
- [ ] Nenhum `any` foi introduzido
- [ ] Nenhum arquivo foi criado fora do diretório canônico
- [ ] Nenhum arquivo foi apagado sem verificar referências
- [ ] Nenhuma lógica duplicada foi introduzida
- [ ] O cliente HTTP do frontend é o mesmo já usado no projeto
- [ ] Os tipos do frontend espelham os DTOs do backend
- [ ] Todos os estados de loading e erro estão tratados nas páginas
- [ ] O AGENTS.md foi respeitado em cada decisão arquitetural