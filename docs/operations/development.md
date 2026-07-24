# Desenvolvimento e manutenção

Guia reproduzível para instalar, executar, testar, depurar e modificar o
Manypost. Leia primeiro `AGENTS.md` e a
[arquitetura](../architecture/README.md).

## Pré-requisitos

- Bun `1.3.14` para o baseline reprodutível;
- Node.js `>=20.19.0` para OpenSpec 1.6.0;
- Docker + Compose para PostgreSQL/Redis locais;
- Git;
- `psql` e `curl` são úteis para E2E/debug, mas não obrigatórios para unit tests.

Confirme:

```bash
bun --version
node --version
docker version
git status --short --branch
```

Não instale OpenSpec globalmente e não use npm/pnpm/Yarn.

## Instalação limpa

Em clone/worktree descartável:

```bash
bun install --frozen-lockfile
bun run openspec --version
```

O segundo comando deve retornar `1.6.0`. Uma instalação congelada não deve
alterar `package.json` ou `bun.lock`.

Não use `git clean`, remoção recursiva ampla ou reset destrutivo para simular
clone limpo em um worktree com mudanças.

## Configurar ambiente sem expor segredo

```bash
cp .env.example .env
```

Preencha localmente os valores obrigatórios. Gere segredos distintos para JWT e
AES-GCM; nunca cole o resultado em issue, commit, log ou documentação.

O catálogo de nomes/formatos fica em
[dados e infraestrutura](../architecture/data-and-infrastructure.md#catálogo-de-ambiente).
`packages/config/src/env.ts` é a fonte executável.

### Clerk

O app esperado é `app_3GuqzZa65tX3maBXqZCIAW8Izxs`. Autentique o CLI na conta
que possui esse app antes de vinculá-lo:

```bash
clerk auth login
clerk link --app app_3GuqzZa65tX3maBXqZCIAW8Izxs
clerk doctor
```

O monorepo não é detectado automaticamente por `clerk init`; a integração usa
`@clerk/nextjs` em `apps/web` e `@clerk/backend` em `apps/api`. Não registre
saída de comandos que contenha chaves. Configure localmente
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` e `CLERK_SECRET_KEY` da mesma instância;
`CLERK_JWT_KEY` é opcional. Como o Next executa em `apps/web`, mantenha os nomes
necessários também em `apps/web/.env.local`; o `clerk env pull` usa
`CLERK_PUBLISHABLE_KEY`, que pode coexistir com o nome `NEXT_PUBLIC_` exigido
pelo bundle web.

No Railway, adicione os mesmos nomes ao serviço `manypost-app` e faça redeploy
somente depois de configurar a instância Clerk de produção. A origem autorizada
pela API é derivada de `PUBLIC_URL`.

Para as credenciais Google da instância de produção:

1. No Clerk Dashboard, abra **SSO connections > Google**, habilite sign-up e
   sign-in e marque credenciais customizadas.
2. Copie a **Authorized Redirect URI** exibida pelo Clerk.
3. No cliente OAuth Web do Google, use como origens JavaScript:
   `https://app.manypost.com.br` e, apenas no cliente de desenvolvimento,
   `http://localhost:3000`.
4. Em URLs de redirecionamento, cole exatamente a URI copiada do Clerk. Não use
   `/sso-callback`, `api.manypost.com.br` ou `mcp.manypost.com.br`.
5. Cole Client ID e Client Secret no Dashboard do Clerk, não no código ou em
   variável client-side. Para público externo, configure a tela de consentimento
   e publique o app OAuth do Google.

O domínio Railway gerado pode ser incluído como origem apenas se usuários
realmente acessarem o web por ele. O domínio canônico é
`https://app.manypost.com.br`.

Rollout: configure primeiro Clerk/Google, depois as variáveis Railway, redeploye
e valide registro, login, Google, refresh e logout. Rollback: remova as duas
variáveis Clerk juntas e redeploye o commit anterior; não há migration ou
conversão de senha para desfazer.

## Subir dependências e aplicação completa

```bash
docker compose up postgres redis -d
bun run dev:all
```

- web: `http://localhost:3000`;
- API/health/docs: `http://localhost:3100`.

`dev:all` usa `scripts/dev-all.ts` para iniciar API e web. Interrompa com
Ctrl-C e confirme que processos filhos encerraram antes de subir outra cópia.
Duas APIs/workers apontando para o mesmo banco podem consumir jobs uma da outra.

### Processos isolados

```bash
bun run dev
bun run dev:web
bun run dev:worker
```

Use terminais separados e `MODE` coerente. Se a API já está em modo `all`, não
suba também o worker dedicado contra a mesma fila/chave sem intenção.

### Backend-only por Compose

```bash
docker compose up --build
```

Abre a API/worker em `http://localhost:3000` e o Scalar em `/docs`. Não sobe
Next.js. As credenciais no compose são públicas e exclusivas para teste local.

## Comandos canônicos

| Comando | Cobertura |
| --- | --- |
| `bun run typecheck` | API, worker e packages |
| `bun run typecheck:web` | Next/web |
| `bun run test` | todos os `*.test.ts` |
| `bun test <arquivo>` | teste focado |
| `bun run check:boundaries` | dependency-cruiser |
| `bun run check:ai-providers` | isolamento nominal de IA |
| `bun run check:brand` | regras visuais/wordmark |
| `bun run check` | todos os itens locais acima |
| `bun run check:ci` | `check` + Drizzle + build web + OpenSpec |
| `bun run db:check` | integridade Drizzle |
| `bun run build:web` | build Next de produção |
| `bun run spec:validate` | mudanças/specs OpenSpec estritos |
| `bun audit` | advisories do grafo atual; retorna non-zero quando encontra |

Não afirme que passou sem executar. Registre exit code, contagem e limitação.

## Estratégia de testes

### Unitários e contrato

`bun:test` cobre domínio/casos de uso, crypto/mídia, middleware, config,
providers com HTTP fake, rate limit/métricas e estado de publicação.

Para bugfix:

1. escreva o menor teste que reproduz;
2. execute e confirme a falha correta;
3. implemente o mínimo;
4. execute teste focado;
5. execute `bun run check`;
6. adicione build/DB/E2E conforme impacto.

Não escreva teste que apenas replica a implementação. Prefira comportamento do
port/contrato e casos negativos.

### E2E HTTP

Scripts:

- `scripts/e2e-auth.ts`;
- `scripts/e2e-publish.ts`;
- `scripts/e2e-public.ts`;
- `scripts/e2e-mcp.ts`;
- `scripts/e2e-billing.ts`.

Eles criam/mutam dados. Use PostgreSQL/Redis descartáveis e portas exclusivas.
O workflow `.github/workflows/ci.yml` é a receita executável mais completa:
aplica migrations no boot, espera `/health` e roda os scripts com hosts de
loopback distintos para provar roteamento app/API/MCP.

Não use banco de desenvolvimento do proprietário nem Railway production.

### Web/browser

Há typecheck/build e unit tests de helpers, mas não existe suíte browser
Playwright/Cypress. Para mudança visual, faça validação manual responsiva e
inclua evidência; essa verificação não substitui `check:brand`/build.

## Validar por tipo de mudança

| Impacto | Comandos mínimos |
| --- | --- |
| docs/OpenSpec | `bun run spec:validate`, `git diff --check` |
| core/API/provider/repository | teste focado, `bun run check` |
| web/UI | teste focado, `bun run check`, `bun run build:web` |
| schema/migration | acima + `bun run db:check` + migration em PG descartável |
| OpenAPI | API local + `generate:api` + `bun run check` + web build |
| CI/Docker | `bun run check`, DB, web, OpenSpec + `docker build` |
| dependência | instalação congelada, full matrix e `bun audit` |

Antes de PR, execute o agregado `bun run check:ci`.

## Debug de boot

1. Rode `bun run typecheck` para separar erro de compilação.
2. Confira apenas nomes ausentes na mensagem Zod; não imprima `process.env`.
3. Verifique serviços:

   ```bash
   docker compose ps
   curl -fsS http://localhost:3100/health
   ```

4. Se migration falhar, registre migration/erro, não connection string.
5. Confirme que `STORAGE_PROVIDER=local`; `s3` ainda falha de propósito.
6. Confirme que não há outra API/worker usando portas/fila.

## Debug HTTP e autorização

- Use correlation ID do response/log para seguir request.
- Identifique superfície pelo host e path antes de depurar handler.
- 401: credencial/cookie/sessão; 403: role/scope/superfície; 404 pode significar
  rota não montada (billing/provider) e não ausência de recurso.
- Teste outro tenant para toda correção de ownership.
- Não copie header Authorization/cookie para relatório.

OpenAPI:

```bash
curl -fsS http://localhost:3100/openapi.json >/tmp/manypost-openapi.json
```

O arquivo temporário é público por definição, mas não deve substituir a geração
oficial do snapshot.

## Debug de filas/publicação

1. Parta do `publicationId`, estado, `jobVersion`, attempt count e timestamps;
   não imprima token/content sensível.
2. Verifique se existe apenas um worker compatível.
3. Diferencie:
   - job não criado;
   - job criado/retry no pg-boss;
   - handler executou e transicionou;
   - provider respondeu;
   - efeito externo ocorreu e persistência falhou.
4. Não reenvie manualmente se o resultado externo é incerto.
5. Use recovery/retry do domínio, nunca update SQL improvisado em produção.
6. Sem evento na UI, compare estado persistido antes de culpar SSE; realtime é
   apenas invalidação.

Query de observação em banco local deve selecionar somente IDs/estado/timestamps.
Não consulte colunas cifradas/hashes para log.

## Debug SSE

Fluxo:

1. `/v1/auth/me` precisa estar 2xx;
2. `/v1/events` responde `text/event-stream`;
3. envia `hello`;
4. mantém a conexão até ping de 25 segundos;
5. Redis entrega eventos por `orgId`.

Browser DevTools mostra a conexão sem expor cookie. Logs
`request timed out after 10 seconds` indicam `idleTimeout` menor que o
keepalive. Pares repetidos de 401 em `/auth/me` e `/events` indicam sessão
expirada/retry incorreto.

## Debug mídia/webhook

- Valide URL/protocolo/DNS/redirect e tamanho com fixtures locais controladas.
- Flags `*_ALLOW_PRIVATE*` só em E2E que controla o destino.
- Não teste SSRF contra metadata/rede real.
- Para webhook, compare timestamp/body/assinatura no receptor de teste sem
  registrar o secret.
- Delivery `FAILED` após cinco tentativas não deve ser reenviado manualmente sem
  confirmar idempotência do receptor.

## Debug Railway somente leitura

Projeto alvo: `manypost`
(`e1e95da7-8df9-4e16-8075-7adefa113572`).

Com CLI autenticado e contexto exato:

```bash
railway status
railway logs --service manypost-app --environment production
```

Use filtros/limites e não solicite dump de variables. Para diagnóstico:

- confirme serviço/ambiente antes de toda consulta;
- compare source commit do deployment;
- use métricas agregadas;
- não faça `railway up`, redeploy, restart, variável, domínio ou volume sem que
  a ação esteja no escopo e seu impacto esteja aprovado.

Depois de merge, espere deployment terminal e valide `/login`, API/MCP e erros.
Estado `SUCCESS` não prova fluxo social externo.

## Adicionar uma feature

1. Crie mudança OpenSpec e identifique capability/requisitos.
2. Use a tabela “onde implementar” da arquitetura.
3. Defina regra/port no core, se compartilhada.
4. Escreva teste falhando.
5. Implemente adapter(s) e entrypoints sem duplicar a regra.
6. Atualize contrato OpenAPI/cliente quando aplicável.
7. Cubra organização, auth, erro, retry/partial success.
8. Atualize arquitetura/fluxos/operação e `CHANGELOG.md`.
9. Rode matriz proporcional.

## Adicionar/alterar uma rota

1. Escolha superfície interna, pública ou MCP.
2. Reuse caso de uso; não coloque regra no handler.
3. Declare Zod request/response/problem+json no registro OpenAPI.
4. Aplique auth, role/scope, host e tenant corretos.
5. Teste sucesso, validação, não autenticado, não autorizado e outro tenant.
6. Para contrato web, suba API e gere:

   ```bash
   API_URL=http://localhost:3100 bun run --cwd apps/web generate:api
   ```

7. Revise `apps/web/openapi.json` e `src/lib/api/schema.d.ts` juntos.

## Alterar banco

Siga `packages/db/AGENTS.md`.

```bash
bun run --cwd packages/db generate -- --name <nome-kebab-case>
bun run db:check
bun run check
```

Teste migration em banco descartável. Nunca edite migration/meta existente.
Planeje expand/contract e rollback antes de DDL destrutivo.

## Adicionar provider

Siga `packages/providers/AGENTS.md`.

1. Implemente adapter e golden tests com fetch fake.
2. Passe o test-kit de contrato.
3. Registre em `packages/providers/src/index.ts`.
4. Adicione secrets no schema/mapeamento e `.env.example`, somente nomes.
5. Atualize catálogo/capabilities/settings e UI/preview/i18n.
6. Regere OpenAPI se o catálogo mudou.
7. Registre gate/App Review separado da implementação.

Não execute API real em teste nem versione credential.

## Alterar job ou retry

Documente em design:

- fonte da verdade e transições;
- claim/fencing;
- efeito externo antes/depois do commit;
- duplicidade e idempotência do provider;
- retry permanent/transient/refresh;
- crash/recovery e partial success;
- Redis ausente/indisponível;
- métricas/logs.

Teste duplicidade e concorrência com infraestrutura real quando a garantia
depender de PostgreSQL/pg-boss/Redis.

## Alterar ambiente/deploy

1. Atualize `packages/config/src/env.ts` e testes.
2. Atualize `.env.example` sem valor real.
3. Atualize catálogo de env neste documento.
4. Verifique todos os `MODE` atingidos.
5. Alinhe `railway.toml`, Dockerfile e configurações alternativas quando
   continuarem suportadas.
6. Faça build Docker e declare health/rollback.
7. Mutação Railway é etapa externa separada; PR de código não concede
   automaticamente permissão para alterar serviço/volume/domínio.

## Checklist de impacto

- [ ] OpenSpec existe/está válido ou exceção está justificada.
- [ ] Owning module e consumidores foram identificados.
- [ ] API interna, pública, MCP, worker e web foram considerados.
- [ ] Auth, scope, role e tenant foram testados.
- [ ] Schema/migration e compatibilidade rolling foram avaliados.
- [ ] Job duplicado, retry, recovery e efeito externo incerto foram avaliados.
- [ ] Redis/storage/billing/provider ausente foram avaliados.
- [ ] OpenAPI/cliente/i18n/brand estão sincronizados.
- [ ] Env/docs/CI/Docker/Railway estão sincronizados.
- [ ] Postiz/Manypost foi classificado, sem substituição global.
- [ ] Changelog descreve impacto e rollback.
- [ ] Comandos executados e limitações estão registrados.

## Revisão final e PR

```bash
bun install --frozen-lockfile
bun run check
bun run db:check
bun run build:web
bun run spec:validate
git diff --check
git status --short
```

Adicione E2E, Docker, audit e Semgrep conforme o diff. Revise
`git diff origin/main...HEAD`, autores e commits. O template de PR exige
resultados reais, riscos, rollback e itens não corrigidos.

Não faça merge com CI falha, conflito, review bloqueante ou branch protection
não satisfeita.
