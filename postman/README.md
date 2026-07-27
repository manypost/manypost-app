# Postman — manypost API

Coleção completa da superfície HTTP do manypost: API humana (`/v1`), API de
máquina (`/public/v1`), aprovação pública, billing/Stripe webhook, OAuth 2.1 do
MCP e o endpoint MCP.

## Arquivos

| Arquivo | Uso |
| --- | --- |
| `manypost.collection.json` | Collection v2.1 — importe no Postman |
| `environments/local.postman_environment.json` | `baseUrl=http://localhost:3100` |
| `environments/cloud.postman_environment.json` | placeholders de produção |

## Importar

1. Postman → **Import** → selecione `manypost.collection.json`.
2. Importe o environment `local` (ou `cloud`).
3. Selecione o environment no canto superior direito.

## Variáveis

| Variável | Descrição |
| --- | --- |
| `baseUrl` | Origem da API (sem barra final) |
| `clerkJwt` | JWT de sessão Clerk (Bearer humano em `/v1`) |
| `apiKey` | Chave `mp_live_…` (Bearer na superfície `/public/v1` e fallback MCP) |
| `oauthAccessToken` | Token `mpo_…` do AS (Bearer MCP preferencial) |
| `channelId`, `groupId`, `mediaId`, `webhookId`, `approvalToken` | IDs de encadeamento |
| `clientId`, `redirectUri`, `codeVerifier`, `codeChallenge`, `authCode` | Fluxo OAuth MCP |

## Auth por pasta

| Pasta | Auth |
| --- | --- |
| `auth` … `billing` (rotas `/v1` humanas) | Bearer `{{clerkJwt}}` |
| `public-*` | Bearer `{{apiKey}}` |
| `approvals` (`/public/approval/…`) | nenhuma |
| `oauth-as` (discovery, DCR, authorize, token) | nenhuma (consent exige Clerk) |
| `mcp` | Bearer `{{oauthAccessToken}}` (ou `{{apiKey}}` com escopo `mcp`) |
| `health` | nenhuma |

## Fluxos úteis

### 1. Humano (Clerk)

1. Entre no app web, copie o JWT da sessão (DevTools → Application / rede) **ou**
   use o bootstrap de E2E com `CLERK_JWT_KEY` local.
2. Cole em `clerkJwt`.
3. `GET /v1/auth/me` deve responder 200.

### 2. Máquina (`mp_live_`)

1. Com sessão Clerk: `POST /v1/api-keys` (escopos desejados, incl. `mcp` se for usar MCP).
2. Guarde o secret exibido **uma vez** em `apiKey`.
3. Use a pasta `public-posts` / `public-channels` / etc.

### 3. OAuth MCP (resumo)

1. `GET /.well-known/oauth-authorization-server`
2. `POST /oauth/register` (DCR) **ou** use `clientId=manypost-mcp`
3. Gere PKCE (`codeVerifier` / `codeChallenge` S256)
4. Abra `GET /oauth/authorize?...` no browser (login Clerk + consent)
5. Troque o `code` em `POST /oauth/token` → `oauthAccessToken`
6. `POST /mcp` com JSON-RPC `initialize`

Detalhes e matriz de clientes: `docs/specs/SPEC_API_MCP.md` e Settings no app.

### 4. SSE

`GET /v1/events` é stream. O Postman limita SSE; use:

```bash
curl -N -H "Authorization: Bearer $CLERK_JWT" "$BASE_URL/v1/events"
```

## Regenerar a collection

A partir da raiz do monorepo (com `apps/web/openapi.json` atual):

```bash
python3 scripts/generate-postman.py
```

Se o OpenAPI mudar (novas rotas), rode a API local e regenerar o cliente web
**antes**:

```bash
API_URL=http://localhost:3100 bun run --cwd apps/web generate:api
python3 scripts/generate-postman.py
```

As pastas `oauth-as` e `mcp` são acrescentadas pelo script mesmo quando ainda
não estão no OpenAPI gerado.

## Segurança

- Nunca versione tokens reais, secrets Stripe ou connection strings.
- Environments de exemplo usam placeholders (`mp_live_replace_me`, hosts de exemplo).
- O body de webhook Stripe e de consent não devem carregar assinaturas reais em
  commits.
