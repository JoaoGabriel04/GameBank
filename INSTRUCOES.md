# Sistema de Avatar de Usuário com Cloudinary

## Objetivo

Implementar um sistema completo de upload, atualização e remoção de avatar de usuário utilizando Cloudinary como armazenamento e banco de dados para persistência da URL da imagem.

---

# Fluxo de Upload

O sistema **NÃO** deve enviar a imagem para o Cloudinary imediatamente após o usuário selecioná-la.

Fluxo esperado:

1. O usuário seleciona uma imagem.
2. O sistema gera apenas um preview local da imagem.
3. Nenhum upload deve ocorrer nesse momento.
4. O upload para o Cloudinary deve acontecer SOMENTE após o usuário confirmar e salvar as alterações.
5. Após upload bem-sucedido, a URL da imagem deve ser salva no banco de dados.
6. Apenas após a confirmação da atualização no banco, o avatar anterior deve ser removido do Cloudinary.

---

# Preview Local

O preview deve ser gerado localmente utilizando mecanismos como:

- `URL.createObjectURL()`
- `FileReader`

O preview não deve depender de upload prévio.

Ao cancelar a edição:

- Nenhum arquivo deve ser enviado ao Cloudinary.
- Nenhuma alteração deve ser persistida.

---

# Validação de Arquivos

## Tipos Permitidos

Permitir apenas formatos configurados pelo sistema, por exemplo:

- JPG
- JPEG
- PNG
- WEBP

Bloquear formatos potencialmente perigosos como:

- SVG (a menos que seja sanitizado)
- EXE
- BAT
- SCR
- Outros executáveis

### Importante

Nunca confiar apenas na extensão do arquivo.

Validar:

- MIME Type
- Extensão
- Conteúdo real do arquivo

---

## Limite de Tamanho

Definir tamanho máximo configurável.

Exemplo:

```text
5 MB
10 MB
```

Arquivos acima do limite devem ser rejeitados antes do upload.

---

## Resolução Máxima

Definir resolução máxima aceitável.

Exemplo:

```text
4096x4096
```

Imagens excessivamente grandes devem ser redimensionadas antes do upload ou rejeitadas.

---

## Resolução Mínima

Definir resolução mínima aceitável.

Exemplo:

```text
100x100
```

Imagens muito pequenas devem ser rejeitadas.

---

# Processamento de Imagem

## Correção EXIF

Corrigir automaticamente a orientação de imagens vindas de dispositivos móveis.

Evitar:

- Imagem deitada
- Imagem invertida
- Rotação incorreta

---

## Compressão

Aplicar compressão e otimização de imagem para reduzir:

- Uso de armazenamento
- Consumo de banda
- Tempo de carregamento

---

## Padronização

Opcionalmente gerar versões padronizadas:

```text
128x128
256x256
512x512
```

para uso em diferentes partes da aplicação.

---

# Atualização de Avatar

Ao trocar o avatar:

1. Upload da nova imagem.
2. Atualização do banco.
3. Exclusão da imagem anterior.

### Regra obrigatória

Nunca excluir a imagem antiga antes da nova estar salva e registrada com sucesso.

---

# Tratamento de Falhas

## Upload realizado mas banco falhou

Cenário:

```text
Upload Cloudinary = sucesso
Banco = falha
```

O sistema deve:

- Registrar erro.
- Remover a imagem recém-enviada.

ou

- Marcar como arquivo órfão para limpeza posterior.

---

## Banco atualizado mas exclusão da imagem antiga falhou

O sistema deve:

- Manter a nova imagem funcionando.
- Registrar erro.
- Agendar nova tentativa de remoção.

---

# Limpeza de Arquivos Órfãos

Criar mecanismo de limpeza periódica.

Objetivo:

Identificar imagens existentes no Cloudinary que não possuem referência no banco.

Essas imagens devem:

- Ser registradas em log.
- Ser removidas após validação.

---

# Cache

Após atualizar o avatar:

O usuário deve visualizar imediatamente a nova imagem.

Evitar problemas de cache do navegador.

Utilizar:

- Versionamento de URL
- Timestamp
- Recursos nativos do Cloudinary

Exemplo:

```text
avatar.jpg?v=123
```

---

# Avatar Padrão

Caso o usuário não possua avatar:

Exibir avatar padrão configurável.

O sistema não deve quebrar caso:

- URL esteja vazia
- URL seja inválida
- Imagem tenha sido removida

---

# Exclusão de Conta

Ao excluir uma conta:

1. Remover registro do usuário.
2. Remover avatar associado do Cloudinary.
3. Garantir que não restem arquivos órfãos.

---

# Segurança

## Rate Limiting

Implementar limite de uploads por usuário.

Exemplo:

```text
5 uploads por minuto
```

ou configuração equivalente.

---

## Autenticação

Somente usuários autenticados podem:

- Enviar avatar
- Atualizar avatar
- Remover avatar

---

## Autorização

Garantir que um usuário só possa alterar seu próprio avatar.

Nunca permitir alteração de avatar de terceiros.

---

# Concorrência

Tratar cenários onde:

- Usuário possui duas abas abertas.
- Usuário possui múltiplos dispositivos conectados.

Definir política de atualização:

```text
Last Write Wins
```

ou mecanismo equivalente.

Evitar corrupção de estado.

---

# Experiência do Usuário

## Loading

Durante upload:

- Mostrar indicador de progresso.
- Informar estado atual.

---

## Bloqueio de Duplo Clique

Durante envio:

- Desabilitar botão de salvar.
- Evitar múltiplos uploads simultâneos.

---

## Upload Interrompido

Se o usuário:

- Fechar a aba
- Perder conexão
- Cancelar operação

O sistema deve tratar corretamente uploads incompletos.

---

# Logs

Registrar eventos importantes:

- Upload iniciado
- Upload concluído
- Upload cancelado
- Upload falhou
- Exclusão realizada
- Exclusão falhou
- Arquivo órfão detectado

---

# Estrutura de Banco

A tabela de usuários deve armazenar pelo menos:

```sql
avatar_url VARCHAR(2048),
avatar_public_id VARCHAR(255),
avatar_updated_at TIMESTAMP
```

### Observação

O campo `avatar_public_id` deve ser utilizado para exclusão segura da imagem no Cloudinary.

Nunca depender apenas da URL para remover arquivos.

---

# Critérios de Qualidade

A implementação deve garantir:

- Ausência de arquivos órfãos.
- Ausência de uploads desnecessários.
- Segurança contra uploads maliciosos.
- Boa experiência de usuário.
- Consistência entre Cloudinary e banco de dados.
- Recuperação adequada em caso de falhas.
- Escalabilidade para milhares de usuários simultâneos.

---

# Cenários de Teste Obrigatórios

## Upload Inicial

- Usuário sem avatar envia uma imagem.
- Avatar é salvo corretamente.

## Troca de Avatar

- Usuário troca avatar existente.
- Avatar antigo é removido.
- Novo avatar é exibido imediatamente.

## Cancelamento

- Usuário seleciona imagem.
- Preview aparece.
- Usuário cancela.
- Nenhum upload é realizado.

## Upload Inválido

- Arquivo excede tamanho máximo.
- Arquivo possui formato não permitido.
- Arquivo possui conteúdo inválido.

O sistema deve rejeitar o upload.

## Falha de Banco

- Upload concluído.
- Banco falha.

O sistema deve evitar arquivos órfãos.

## Falha na Exclusão do Avatar Antigo

- Novo avatar permanece funcional.
- Exclusão antiga é reagendada.

## Exclusão de Conta

- Conta removida.
- Avatar removido.
- Nenhum arquivo órfão permanece.

## Concorrência

- Atualizações simultâneas em múltiplas abas.
- Estado final permanece consistente.

## Cache

- Avatar atualizado aparece imediatamente sem necessidade de limpar cache manualmente.