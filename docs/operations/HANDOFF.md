# Handoff — Home operacional e deploy Coolify

Atualizado em **2026-08-05**. Este documento registra o estado exato entregue para o próximo
desenvolvedor. Leia primeiro o [`AGENTS.md`](../../AGENTS.md), a
[arquitetura vigente](../architecture/README.md) e o [fluxo OpenSpec](../openspec.md).

## Estado entregue

- Branch: `feat/ai-image-quality-modes`.
- Commit publicado: `deeb1bcf7d4b8c81c910a809dd254b53e787ea9e` —
  `fix(web): complete home operational dashboard`.
- Remoto `origin/feat/ai-image-quality-modes` confirmado no mesmo commit.
- Deploy no alvo Coolify/VPS configurado localmente: `ez0p3dwc4olbwdigpmx9vfxd`.
- Estado terminal observado: `finished`.
- Smoke público observado: `/login` respondeu HTTP 200.
- Nenhuma variável, domínio, volume, serviço ou migration foi alterado no deploy.
- Rollback de aplicação: redeploy do commit anterior `6391140`. Não remova volumes nem sincronize
  ambiente durante o rollback.

O OpenSpec [`add-home-operational-blocks`](../../openspec/changes/add-home-operational-blocks/)
está implementado em **29/31 tasks**. Ele permanece aberto de propósito: faltam somente a evidência
autenticada de navegador (task 6.4) e o archive posterior (task 7.2).

## O que mudou

A `/inicio` agora degrada cada fonte separadamente. Falha do resumo não apaga próximas publicações,
rascunhos, pipeline ou atividade; pending/error continuam ocupando a posição do próprio bloco e
oferecem retry local. As leituras têm polling de 60 segundos como fallback para SSE sem pub/sub.

Também foram fechadas as divergências encontradas na revisão:

- sucesso assíncrono não cria card dentro de card;
- próximas publicações mostram explicitamente `Agendado`;
- rascunho local mostra idade e reconhece texto principal, override, settings, mídia principal,
  texto/mídia de thread;
- toda mutação material do composer atualiza `contentUpdatedAt`;
- pipeline truncado assume que as contagens são parciais;
- atividade disponível continua visível se pipeline ou notificações falharem isoladamente;
- tempos relativos e decisões dependentes de hora avançam uma vez por minuto;
- controles compactos da Home têm piso explícito de 32px;
- notificações de aprovação novas apontam para `/kanban?post=<groupId>`;
- links históricos `/posts/<groupId>` são convertidos para a rota válida;
- o Quadro abre o detalhe indicado por `post` e limpa o parâmetro ao fechar;
- rascunhos fora da janela datada do feed usam o `GET` do grupo para conteúdo, preview e edição.

Arquivos centrais:

- [`apps/web/src/features/home/home-view.tsx`](../../apps/web/src/features/home/home-view.tsx)
- [`apps/web/src/features/home/logic.ts`](../../apps/web/src/features/home/logic.ts)
- [`apps/web/src/features/home/home-blocks-v2.tsx`](../../apps/web/src/features/home/home-blocks-v2.tsx)
- [`apps/web/src/features/composer/store.ts`](../../apps/web/src/features/composer/store.ts)
- [`apps/web/src/features/kanban/kanban-board.tsx`](../../apps/web/src/features/kanban/kanban-board.tsx)
- [`apps/web/src/features/publications/post-detail-sheet.tsx`](../../apps/web/src/features/publications/post-detail-sheet.tsx)
- [`packages/core/src/application/use-cases/approvals.ts`](../../packages/core/src/application/use-cases/approvals.ts)

O plano executado e a evidência detalhada estão em
[`docs/superpowers/plans/2026-08-05-home-operational-completion.md`](../superpowers/plans/2026-08-05-home-operational-completion.md).

## Evidência verificada

Última validação, já incluindo os follow-ups das duas revisões independentes:

- `bun run check`: **1359 pass**, **18 skip** dependentes de PostgreSQL, **0 fail**, 3850 asserts;
- dependency-cruiser: 612 módulos, 1951 dependências, nenhuma violação;
- `check:ai-providers`: verde;
- `check:brand`: 19 checks verdes;
- `bun run db:check`: schema Drizzle válido;
- `bun run build:web`: build bem-sucedido, 19 páginas, incluindo `/inicio` e `/kanban`;
- `bun run spec:validate`: 30/30 itens válidos;
- `git diff --check`: limpo;
- revisão independente final: nenhum achado Critical ou Important.

O E2E de insights foi tentado sem stack descartável configurada e encerrou antes de acessar dados.
Não aponte esse script para banco de desenvolvimento ou produção apenas para fechar checklist.

## Pendência imediata

Executar task 6.4 com uma sessão autenticada segura, em **1440×900** e **375×812**:

1. loading e erro por bloco, sem colapso da tela;
2. atividade parcial quando uma das fontes falha;
3. primeiro uso escondendo todos os blocos operacionais;
4. falha de publicação aparecendo sem reload após evento realtime;
5. fallback de polling quando realtime não entrega;
6. deep link de aprovação abrindo post agendado e rascunho fora do feed;
7. foco, overflow, alvos de 32px e `prefers-reduced-motion`.

Registre screenshots/evidência sem cookies ou tokens. Se tudo passar, marque 6.4, faça a revisão
final de identidade/segredos/gerados, arquive `add-home-operational-blocks` com o skill/CLI OpenSpec e
revalide. O archive não deve ser antecipado só porque código e deploy estão verdes.

## Próximas iniciativas recomendadas

Não misture estas frentes no archive da Home. Cada uma exige mudança OpenSpec própria:

1. **E2E visual e acessibilidade autenticado**, criando fixtures descartáveis e baseline estável.
2. **Central de falhas e reconexão**, com retry condicional, estado incerto, idempotência e ações por
   canal; nunca oferecer retry cego.
3. **Templates/biblioteca de ideias** e, separadamente, **agenda recorrente**.
4. **Convites, papéis e troca de organização**, com testes negativos de isolamento tenant.
5. **Métricas de um provider**, antes de campanhas, relatórios ou IA baseada em desempenho.

O backlog argumentado está em
[`docs/audits/2026-07-28-product-improvement-opportunities.md`](../audits/2026-07-28-product-improvement-opportunities.md).

## Cuidados com o workspace e deploy

Há artefatos locais não versionados de outra iniciativa (`.playwright-cli/`, planos de AI media e
`openspec/changes/add-ai-media-generation-runtime/`). Eles não pertencem a esta entrega. Não use
`git add .`, `git clean`, reset destrutivo ou remoção ampla; classifique-os antes de qualquer commit.

O deploy usado nesta entrega é o script ignorado
`.local/coolify-manypost/deploy-manypost.sh`. Ele publica a branch atual, mantém o ambiente remoto e
faz smoke. Não passe `--sync-env` sem autorização explícita e revisão das variáveis. O arquivo local
de configuração é confidencial: não o leia, imprima, copie para documentação ou versione.
