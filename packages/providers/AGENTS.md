# AGENTS.md — `packages/providers`

Aplicam-se também todas as regras do `AGENTS.md` da raiz. Este package adapta
contratos de redes externas ao port `SocialProvider`; não contém route handler,
acesso direto ao banco ou decisão de plano/billing.

## Onde alterar

- `src/<provider>/`: implementação e golden tests de uma integração;
- `src/channel-provider-registry.ts`: registro disponível ao runtime;
- `src/identity.providers.ts`: providers de login social;
- `test-kit/`: contrato comum reutilizado por todos os providers;
- `src/fake/`: provider determinístico para testes E2E.

## Contrato obrigatório

- Declare capabilities reais, limites, método de conexão e `settingsSchema`.
- Normalize settings antes do request externo; nunca repasse configuração
  desconhecida.
- Use o contexto HTTP/segredos injetado pelo composition root. Não leia `.env`
  dentro do provider.
- Nunca logue access token, refresh token, authorization code, client secret ou
  corpo externo que possa contê-los.
- `classifyError` deve distinguir permanent, transient e refresh-token com base
  em status/código documentado e ter teste.
- Depois que a rede confirmou criação, uma falha ao buscar permalink/metadata
  deve ser best-effort quando retry puder duplicar conteúdo.
- Thread/reply/carrossel deve registrar partial success e preservar a ordem.
- URLs, escopos, versões de API e limites da plataforma precisam de fonte
  oficial na proposta/design e de data de verificação.
- Mantenha comentário `Derived from Postiz (AGPL-3.0)` quando o trecho continuar
  uma derivação reconhecível; isso é atribuição, não branding substituível.

## Testes

Não chame APIs reais e não use credenciais reais/sandbox versionadas. Injete um
`fetch` fake e verifique requests/responses serializados.

Um provider novo ou alterado deve cobrir, conforme aplicável:

- contrato do `test-kit`;
- URL OAuth, state/PKCE, escopos e callback;
- exchange e refresh com rotação;
- publicação por tipo de mídia e settings;
- thread/reply/carrossel e partial failure;
- resposta malformada, 401/403, 429, 5xx e timeout;
- classificação de erro;
- capability/settings incompatível rejeitada antes da rede;
- ausência de segredo sem expor seu valor.

Execute:

```bash
bun test packages/providers/src/<provider>
bun run check
```

Se capabilities/settings mudarem, atualize o catálogo OpenAPI, gere o snapshot
web pela API local e valide o composer/preview. App Review, permissões e
credenciais externas são gates humanos/operacionais e devem ser registrados,
nunca simulados como aprovados.
