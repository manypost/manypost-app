# AGENTS.md — Manypost

Este arquivo é o contrato operacional da raiz. Um `AGENTS.md` mais próximo do
arquivo alterado adiciona regras ao seu escopo; em conflito, prevalece a regra
mais específica, sem relaxar segurança, atribuição ou proteção de dados.

## Visão geral

Manypost é uma plataforma multi-tenant de agendamento e publicação multicanal,
derivada do Postiz e licenciada sob AGPL-3.0. O monorepo Bun/TypeScript contém:

- `apps/api`: Hono, autenticação, API interna/pública, MCP, webhooks e OpenAPI;
- `apps/web`: Next.js App Router e cliente OpenAPI;
- `apps/worker`: entrada dedicada do runtime pg-boss;
- `packages/contracts`: tipos, enums e eventos compartilhados;
- `packages/config`: validação de ambiente e hosts;
- `packages/core`: domínio, casos de uso, ports e infraestrutura compartilhada;
- `packages/db`: Drizzle/PostgreSQL, migrations e repositories;
- `packages/providers`: adaptadores de redes sociais;
- `packages/queue`: pg-boss, Redis, rate limit, idempotência e realtime.

Comece por `docs/architecture/README.md` e use
`docs/audits/2026-07-23-initial-diagnosis.md` apenas como fotografia datada.
Documentos em `docs/principal/` e `docs/specs/` podem conter decisões históricas
ou aspiracionais; confirme comportamento no código e nos specs vivos em
`openspec/specs/`.

## Ferramentas e comandos

Bun é obrigatório. Não use npm, pnpm ou Yarn para instalar/atualizar pacotes e
não crie outro lockfile.

```bash
bun install --frozen-lockfile  # instalação reproduzível
bun run dev                    # API (e worker, conforme MODE)
bun run dev:web                # Next.js
bun run dev:worker             # worker dedicado
bun run dev:all                # API :3100 + web :3000

bun run typecheck
bun run typecheck:web
bun run test
bun run check                  # typechecks, testes, fronteiras, IA e brand
bun run db:check               # schema Drizzle
bun run build:web              # build Next.js de produção
bun run spec:validate          # OpenSpec estrito
```

Não invente um comando de lint ou format: nenhum está configurado. Prefira
formatar como o arquivo vizinho e use `git diff --check`.

## Fluxo OpenSpec obrigatório

Antes de implementar feature, mudança de comportamento, schema, integração,
deploy ou refatoração entre módulos:

1. crie/atualize uma mudança em `openspec/changes/`;
2. obtenha as instruções do CLI para cada artefato;
3. escreva proposta e requisitos; inclua design para mudanças cross-cutting,
   de dados, segurança, concorrência ou migração;
4. valide com `bun run spec:validate`;
5. implemente as tasks test-first;
6. atualize documentação e `CHANGELOG.md`;
7. arquive somente depois de concluída e revalide.

Guia e comandos: `docs/openspec.md`. Correção ortográfica ou manutenção
local comprovadamente sem comportamento pode dispensar mudança nova, mas o PR
deve justificar a exceção.

## Fronteiras arquiteturais

As regras executáveis estão em `.dependency-cruiser.cjs`:

- `packages/contracts` é folha: tipos/schemas/constantes, sem lógica de negócio;
- `packages/core` não importa `apps/*`, `packages/db` ou `packages/providers`;
- `packages/core/src/domain` não depende de frameworks;
- `apps/web` não importa código de servidor; comunica-se pelo cliente OpenAPI;
- `apps/api/src/container.ts` e entradas de app são os composition roots.

Novos comportamentos pertencem ao caso de uso/port em `core`; Hono deve adaptar
HTTP, repositories devem adaptar persistência e providers devem adaptar redes.
Não coloque regra de negócio em route handler, componente React ou SQL quando
ela precisa ser compartilhada/testada.

`packages/core` não é hoje totalmente puro: `src/infra/` contém crypto e mídia.
Não amplie essa exceção sem design OpenSpec e sem atualizar as fronteiras.

## Código e contratos

- TypeScript estrito; não esconda erros com `any`, `@ts-ignore` ou cast amplo
  sem justificativa localizada.
- Erros HTTP usam problem+json e códigos estáveis de `@manypost/contracts`.
- Alteração de rota/schema OpenAPI exige API local e:

  ```bash
  API_URL=http://localhost:3100 bun run --cwd apps/web generate:api
  ```

  Revise juntos `apps/web/openapi.json` e
  `apps/web/src/lib/api/schema.d.ts`.
- Estados de publicação mudam somente pela máquina de estados e operações
  condicionais. Em incerteza após chamada externa, não programe retry cego.
- Toda operação multi-tenant deve provar escopo por organização, diretamente
  ou por join a um pai já escopado.
- Use transação para invariantes no banco; enfileire efeitos externos somente
  depois do commit.
- Preserve request/correlation IDs e logging estruturado; nunca logue payloads
  que contenham tokens.

## Segurança

- Nunca leia, imprima, copie para docs ou versione valores de `.env`, Railway,
  cookies, tokens, chaves, secrets Stripe/OAuth ou connection strings.
- Documente somente nome, propósito, obrigatoriedade e formato de variável.
- `ENCRYPTION_KEY` e `JWT_SECRET` são independentes. Tokens de canal e webhook
  permanecem cifrados; não contorne `CryptoService`.
- Mudanças em auth, cookies, CORS, SSRF, uploads, webhooks, MCP ou API pública
  exigem testes negativos e revisão explícita de autorização/organização.
- Os ports Redis são opcionais no package de queue e falham abertos quando
  ausentes, mas o env atual exige `REDIS_URL`; não altere esse contrato de forma
  implícita.
- Não faça operação destrutiva de dados, volume, Railway ou Git sem alvo
  resolvido, justificativa, rollback e autorização correspondente.

## Arquivos gerados, históricos e protegidos

Não edite manualmente:

- `bun.lock` — use Bun;
- `apps/web/src/lib/api/schema.d.ts` e `apps/web/openapi.json` — use
  `generate:api`;
- `packages/db/migrations/meta/*` — use Drizzle Kit;
- migrations existentes `packages/db/migrations/000*.sql`;
- `.codex/skills/openspec-*` — use `openspec init/update`;
- artefatos `.next/`, `node_modules/` e `dist/`.

Não renomeie/remova sem análise:

- `LICENSE`, `NOTICE`, `ATTRIBUTION.md`, `packages/contracts/LICENSE`;
- `docs/principal/POSTIZ_ANALYSIS.md`;
- `docs/references for postiz/`;
- comentários de derivação exigidos pela AGPL;
- nomes persistidos, migration history e identificadores externos.

## Banco e dados

As regras adicionais de `packages/db/AGENTS.md` são obrigatórias nesse package.
Em qualquer mudança:

- não reescreva migration aplicada; crie migration nova;
- inspecione SQL e metadata gerados;
- verifique rollback/compatibilidade entre aplicação antiga e schema novo;
- preserve dados existentes e isolamento de organização;
- execute `bun run db:check`, testes relacionados e E2E de persistência quando
  o risco justificar;
- não execute migration destrutiva em produção como validação.

## Integrações e processos assíncronos

Providers seguem `packages/providers/AGENTS.md`. Não faça chamadas reais em
testes automatizados nem use credenciais de sandbox versionadas.

Mudanças em publish, thread, recovery ou webhook devem cobrir:

- entrega duplicada e idempotência;
- crash entre efeito externo e persistência;
- classificação permanent/transient/refresh-token;
- limites por provider/canal e ausência do Redis;
- stale job/version fencing;
- partial success de thread/carrossel;
- observabilidade sem segredo.

Não capture exceção de job apenas para “manter o worker vivo” sem definir se
pg-boss deve fazer retry.

## Critério mínimo de testes

Escreva primeiro um teste que falhe para feature/bugfix. Confirme que a falha
corresponde ao comportamento ausente, implemente o mínimo e rode:

| Mudança | Validação mínima |
| --- | --- |
| docs/config sem runtime | `bun run spec:validate`, `git diff --check` |
| core/provider/repository/API | teste focado + `bun run check` |
| web/UI | teste focado quando possível + `bun run check` + `bun run build:web` |
| schema/migration | testes + `bun run db:check` + migration em banco descartável |
| OpenAPI | API local, `generate:api`, `bun run check` |
| deploy/CI | `bun run check`, `bun run db:check`, `bun run build:web`, OpenSpec e build Docker |

E2E HTTP existentes ficam em `scripts/e2e-*.ts` e exigem PostgreSQL/Redis
isolados. Nunca aponte E2E destrutivo para banco de desenvolvimento ou produção.

## Identidade Manypost e atribuição

O produto atual é Manypost; preserve `manypost` em caixa baixa onde o brand
system assim exige. Não execute substituição global de Postiz.

Toda ocorrência deve ser classificada como:

1. substituição direta segura;
2. refatoração técnica;
3. compatibilidade;
4. licença/atribuição;
5. histórica;
6. decisão humana.

Somente categoria 1 pode mudar sem uma migração específica. Atualize
`docs/audits/postiz-reference-inventory.md` e execute busca residual/brand check.

## Documentação e changelog

No mesmo PR:

- comportamento/contrato: atualize OpenSpec e doc do fluxo;
- novo módulo/diretório: atualize mapa do repositório;
- env/deploy/queue/storage: atualize dados e infraestrutura;
- comando/processo: atualize operação e este arquivo se a regra mudou;
- impacto de usuário, dev ou operação: atualize `CHANGELOG.md`.

Não transforme relatório datado em fonte normativa. Mantenha links e caminhos
testáveis e diferencie fato confirmado, hipótese e decisão pendente.

## Commits e Pull Requests

Use Conventional Commits (`feat`, `fix`, `docs`, `refactor`, `test`, `ci`,
`chore`) e um assunto objetivo. Um commit deve ter uma responsabilidade
revisável; não crie commits vazios ou artificiais e não adicione coautores.

Todo PR deve:

- apontar para `main` e citar a mudança OpenSpec;
- descrever contexto, impacto, arquivos principais e identidade;
- declarar migrations, breaking changes, riscos e itens não corrigidos;
- listar comandos realmente executados e resultados, sem afirmar o que não foi
  rodado;
- incluir rollback e impacto Railway;
- manter CI verde, sem conflito ou revisão bloqueante;
- não ignorar branch protection.

## Definição de pronto

Uma mudança está pronta somente quando requisitos e tasks correspondem ao
diff, testes relevantes passaram, documentação/changelog estão sincronizados,
OpenSpec é válido, não há segredo/artefato acidental, autoria está correta e o
PR possui evidência suficiente para revisão e rollback. Deploy/merge só estão
concluídos após verificação do commit resultante e do estado operacional.
