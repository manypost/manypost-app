# Composer Authoring Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar o composer modular do PR #53 com a assistência de IA, geração de imagem e home operacional desta branch sem perda de texto, saída paga descartada, validação inacessível ou conflito pendente.

**Architecture:** `origin/main` fornece a estrutura modular e a propriedade local das instâncias TipTap. Os contratos seguros da branch continuam sendo a fonte para escopo de IA, instruções catalogadas no servidor, distribuição de variantes e geração de imagem. Regras que decidem bloqueio, atalhos e persistência ficam em funções puras testáveis; componentes React apenas adaptam esses resultados.

**Tech Stack:** Bun 1.3, TypeScript estrito, React 19, Next.js App Router, Zustand, TanStack Query, TipTap, next-intl, OpenSpec e Playwright CLI.

## Global Constraints

- Usar somente Bun e preservar `bun.lock`.
- Manter exatamente um `h1` por página e os tokens do brand system.
- Nunca aplicar uma reescrita global contra o limite arbitrário do primeiro canal.
- Nunca descartar variantes de IA já geradas por canal.
- Toda mudança comportamental deve ter teste vermelho antes da implementação.
- Não alterar contratos gerados de OpenAPI manualmente.
- O resultado final deve estar baseado em `origin/main`, sem conflito, com OpenSpec, documentação e changelog sincronizados.

---

### Task 1: Integrar a arquitetura modular e reconciliar o OpenSpec

**Files:**
- Modify: `openspec/changes/refine-composer-authoring/proposal.md`
- Modify: `openspec/changes/refine-composer-authoring/design.md`
- Modify: `openspec/changes/refine-composer-authoring/specs/composer-authoring-experience/spec.md`
- Modify: `openspec/changes/refine-composer-authoring/tasks.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/principal/CHANGELOG_ONDAS.md`
- Modify: `docs/principal/STATUS.md`

**Interfaces:**
- Consumes: `origin/main` no commit que contém o PR #53 e a branch `feat/ai-fixes-home-and-image`.
- Produces: uma árvore sem conflitos cuja base visual é o composer modular e cujo plano registra as regressões encontradas.

- [ ] **Step 1: Mesclar `origin/main` sem finalizar o commit**

Run: `git merge --no-commit --no-ff origin/main`
Expected: conflitos somente nos seis arquivos já identificados pela revisão.

- [ ] **Step 2: Manter a arquitetura modular nos conflitos de implementação**

Resolver `composer-view.tsx` e `formatting-toolbar.tsx` a partir da estrutura de `origin/main`; integrar `ai-actions.tsx` manualmente, preservando o catálogo `RewriteId`, resposta `overLimit`, desfazer e variantes por canal.

- [ ] **Step 3: Unir os históricos documentais**

Preservar as entradas do PR #53 e as entradas de IA/Home/imagem nos três arquivos documentais conflitantes, sem marcadores de merge e sem whitespace final.

- [ ] **Step 4: Atualizar os artefatos OpenSpec**

Adicionar cenários explícitos para IA por escopo, validação total no rodapé, atalhos suspensos durante superfícies bloqueantes, confirmação verdadeira de persistência e sugestão de proporção por canal.

- [ ] **Step 5: Validar a fase de planejamento**

Run: `bun run spec:validate`
Expected: todos os specs válidos e nenhuma task duplicada ou falsamente pendente.

### Task 2: Preservar os contratos de IA por escopo

**Files:**
- Modify: `apps/web/src/features/ai/ai-actions.tsx`
- Modify: `apps/web/src/features/ai/ai-actions.test.tsx`
- Modify: `apps/web/src/features/composer/composer-editor-card.tsx`
- Modify: `apps/web/src/features/composer/composer-global-tab.tsx`
- Modify: `apps/web/src/features/composer/composer-channel-tab.tsx`
- Modify: `apps/web/src/features/composer/composer-thread.tsx`
- Modify: `apps/web/src/features/composer/composer-view.tsx`

**Interfaces:**
- Consumes: `AiActionsProps.scope`, `onVariants`, `networkNameOf`, `RewriteId` e o resultado completo de `/v1/ai/rewrite`.
- Produces: ações globais sem `channelId`, ações de canal escopadas e threads sem adaptação multicanal impossível.

- [ ] **Step 1: Escrever testes de escopo que falham**

Cobrir uma função pura que devolva a estratégia:

```ts
expect(resolveAiScope('global', ['x', 'linkedin'])).toEqual({
  rewriteChannelId: undefined,
  canAdaptPerChannel: true,
});
expect(resolveAiScope('thread', ['x', 'linkedin']).canAdaptPerChannel).toBe(false);
```

- [ ] **Step 2: Executar o teste e confirmar o vermelho**

Run: `bun test apps/web/src/features/ai/ai-actions.test.tsx`
Expected: falha porque a estratégia por escopo ainda não está exportada pela versão modular.

- [ ] **Step 3: Implementar a estratégia mínima e ligar os componentes**

O cartão recebe o escopo e os callbacks; Global distribui todas as variantes como overrides, Channel usa um canal e Thread não oferece adaptação.

- [ ] **Step 4: Verificar o verde**

Run: `bun test apps/web/src/features/ai/ai-actions.test.tsx`
Expected: todos os testes de IA do frontend passam.

### Task 3: Explicar todo bloqueio e limitar o atalho ao contexto seguro

**Files:**
- Modify: `apps/web/src/features/composer/validation.ts`
- Modify: `apps/web/src/features/composer/validation.test.ts`
- Modify: `apps/web/src/features/composer/composer-footer.tsx`
- Create: `apps/web/src/features/composer/composer-footer.test.ts`

**Interfaces:**
- Produces: `issuesDoEscopo(..., { kind: 'all' })` para o rodapé e `podeAgendarPorAtalho(...)` para a decisão do listener.

- [ ] **Step 1: Escrever o teste vermelho para issue exclusiva de thread**

```ts
expect(
  issuesDoEscopo(
    [{ message: 'Réplica vazia', origin: { kind: 'thread', threadKey: 't1' } }],
    { kind: 'all' },
  ),
).toHaveLength(1);
```

- [ ] **Step 2: Escrever o teste vermelho para superfície bloqueante**

```ts
expect(podeAgendarPorAtalho({ blocked: false, pending: false, overlayOpen: true })).toBe(false);
```

- [ ] **Step 3: Confirmar as falhas**

Run: `bun test apps/web/src/features/composer/validation.test.ts apps/web/src/features/composer/composer-footer.test.ts`
Expected: falha por escopo `all` ausente e helper de atalho inexistente.

- [ ] **Step 4: Implementar e verificar**

O rodapé usa o escopo total; o listener ignora eventos quando o descarte ou outra superfície bloqueante está aberta e ignora repetição do teclado.

Run: `bun test apps/web/src/features/composer/validation.test.ts apps/web/src/features/composer/composer-footer.test.ts`
Expected: verde.

### Task 4: Tornar o estado de persistência verdadeiro

**Files:**
- Modify: `apps/web/src/features/composer/store.ts`
- Modify: `apps/web/src/features/composer/composer-footer.tsx`
- Create: `apps/web/src/features/composer/draft-persistence.ts`
- Create: `apps/web/src/features/composer/draft-persistence.test.ts`

**Interfaces:**
- Produces: estado `saving | saved | failed` derivado da conclusão real de `storage.setItem`, sem afirmar sucesso no callback genérico do store.

- [ ] **Step 1: Escrever testes vermelhos da máquina de estado**

Cobrir sucesso, rejeição/exception de storage e nova escrita que invalida um sucesso anterior.

- [ ] **Step 2: Confirmar o vermelho**

Run: `bun test apps/web/src/features/composer/draft-persistence.test.ts`
Expected: falha porque o adaptador de persistência confirmável ainda não existe.

- [ ] **Step 3: Implementar o adaptador mínimo**

Usar storage explícito do middleware Zustand e emitir confirmação somente após a escrita correspondente concluir; falha mostra aviso neutro, sem apagar o rascunho em memória.

- [ ] **Step 4: Verificar o verde**

Run: `bun test apps/web/src/features/composer/draft-persistence.test.ts`
Expected: todos os estados passam.

### Task 5: Manter geração de imagem consciente do canal

**Files:**
- Modify: `apps/web/src/features/composer/composer-editor-card.tsx`
- Modify: `apps/web/src/features/composer/composer-global-tab.tsx`
- Modify: `apps/web/src/features/composer/composer-thread.tsx`
- Modify: `apps/web/src/features/composer/media-picker.tsx`

**Interfaces:**
- Consumes: `MediaPicker.channelId?: string`.
- Produces: o editor global sugere a proporção do primeiro canal selecionado; itens de thread mantêm escolha explícita quando o destino é multicanal.

- [ ] **Step 1: Adicionar uma asserção estrutural que falha**

O teste do cartão deve provar que o contrato de mídia aceita e encaminha `channelId`.

- [ ] **Step 2: Confirmar o vermelho**

Run: `bun test apps/web/src/features/composer`
Expected: falha no novo contrato antes da implementação.

- [ ] **Step 3: Encaminhar o canal sem criar estado duplicado**

Global passa `channelIds[0]`; Channel não oferece mídia principal separada; Thread não presume uma única rede.

- [ ] **Step 4: Verificar o verde**

Run: `bun test apps/web/src/features/composer`
Expected: todos os testes focados passam.

### Task 6: Fechamento, verificação combinada e prontidão do PR

**Files:**
- Modify: `openspec/changes/refine-composer-authoring/tasks.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/principal/CHANGELOG_ONDAS.md`
- Modify: `docs/principal/STATUS.md`

**Interfaces:**
- Produces: branch baseada em `origin/main`, OpenSpec arquivado, histórico revisável e evidência reproduzível.

- [ ] **Step 1: Executar validações focadas**

Run: `bun test apps/web/src/features/composer apps/web/src/features/ai`
Expected: zero falhas e nenhuma advertência inesperada de persistência.

- [ ] **Step 2: Executar a porta completa**

Run: `bun run check:ci` com PostgreSQL e Redis descartáveis.
Expected: typechecks, testes, fronteiras, banco, build web e OpenSpec verdes.

- [ ] **Step 3: Executar E2Es afetados**

Run: `bun run scripts/e2e-ai.ts` e `bun run scripts/e2e-insights.ts` contra a stack descartável.
Expected: idempotência, reescrita sem corte, imagem, agregados e isolamento passam.

- [ ] **Step 4: Verificar a UI local**

Com API e web locais, usar Playwright CLI em desktop e mobile para validar: global X + LinkedIn, legenda por canal, reescrita longa, thread vazia, descarte + atalho e geração de imagem.

- [ ] **Step 5: Concluir OpenSpec e documentação**

Marcar apenas tasks verificadas, sincronizar o delta spec, arquivar `refine-composer-authoring` e reexecutar `bun run spec:validate`.

- [ ] **Step 6: Revisar o diff e a prontidão de merge**

Run: `git diff --check`, busca por marcadores de conflito, `git status --short` e `git merge-base --is-ancestor origin/main HEAD`.
Expected: árvore limpa, sem conflito, sem segredo, autoria correta e `origin/main` ancestral da branch.
