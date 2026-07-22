# Documentação do manypost

[← Voltar ao README do projeto](../README.md) · [Contribuir](../CONTRIBUTING.md) · [Testar em 5 minutos](../TESTING.md) · [Licença AGPL-3.0](../LICENSE) · [Atribuição ao Postiz](../ATTRIBUTION.md)

Toda a documentação do projeto vive aqui, no mesmo repositório e sob a mesma licença do código
(**AGPL-3.0**). Não existe documentação interna paralela: o que orienta o desenvolvimento é o que
você está lendo — [por quê](#por-que-o-planejamento-também-é-público).

---

## Por onde começar

| Você é… | Comece por | Depois |
|---|---|---|
| **Quem quer só usar** (self-host) | [TESTING.md](../TESTING.md) — subir com Docker e publicar um post de teste | [INTEGRATIONS_SETUP.md](principal/INTEGRATIONS_SETUP.md) para conectar redes de verdade |
| **Quem vai contribuir com código** | [STATUS.md](principal/STATUS.md) — o que funciona, o que falta, com prova | [CONTRIBUTING.md](../CONTRIBUTING.md) + a spec da área que você vai mexer |
| **Quem integra por API ou agente de IA** | [SPEC_API_MCP.md](specs/SPEC_API_MCP.md) — REST pública e servidor MCP | `/docs` na sua instância (explorador OpenAPI ao vivo) |
| **Quem vai mexer em qualquer tela** | [BRAND_SYSTEM.md](brand/BRAND_SYSTEM.md) — **obrigatório** | [brand/README.md](brand/README.md) + [SPEC_FRONTEND.md](specs/SPEC_FRONTEND.md) |
| **Quem quer entender as escolhas** | [DECISIONS.md](principal/DECISIONS.md) — decisões congeladas, com o porquê | [POSTIZ_ANALYSIS.md](principal/POSTIZ_ANALYSIS.md) — a análise que as originou |

---

## `principal/` — estado, decisões e planejamento

O planejamento vivo do projeto: onde estamos, o que já foi decidido e o que falta.

| Documento | O que responde |
|---|---|
| **[STATUS.md](principal/STATUS.md)** ⭐ | **Onde o projeto está agora**: o que já funciona (com prova), o que falta (com a spec de cada item) e como rodar/verificar localmente |
| [CHANGELOG_ONDAS.md](principal/CHANGELOG_ONDAS.md) | Como chegamos aqui — cada fatia entregue, onda a onda, com as provas de cada uma |
| [DECISIONS.md](principal/DECISIONS.md) | Decisões **congeladas** (v1 + adendos v1.1 e v1.2), cada uma com a justificativa. Não re-litigar sem abrir uma versão nova |
| [PLANS.md](principal/PLANS.md) | Os planos do serviço gerenciado e como cada feature vira gate comercial — sem nunca fechar código |
| [platform-gates.md](principal/platform-gates.md) | Rastreio dos processos de aprovação por plataforma (Meta, TikTok, X, YouTube…) — o caminho crítico externo |
| [INTEGRATIONS_SETUP.md](principal/INTEGRATIONS_SETUP.md) | **Guia para humanos**: como obter as credenciais de cada rede social, passo a passo e sem tecniquês |
| [POSTIZ_ANALYSIS.md](principal/POSTIZ_ANALYSIS.md) | A análise técnica do [Postiz](https://github.com/gitroomhq/postiz-app) que fundamenta a arquitetura e a derivação declarada |

## `specs/` — especificações técnicas

Cada spec cobre um contexto do sistema e diz o que vale como certo. Quando código e spec divergem,
um dos dois está errado — corrija o par, não só um lado.

| Spec | Contexto | Leia quando for mexer em |
|---|---|---|
| [SPEC_ARCHITECTURE.md](specs/SPEC_ARCHITECTURE.md) | Visão geral, bounded contexts, fronteiras do monorepo | Qualquer coisa estrutural |
| [SPEC_BACKEND.md](specs/SPEC_BACKEND.md) | `apps/api`, `apps/worker`, `packages/core` (DDD, ports, use-cases) | Rotas, use-cases, composition root |
| [SPEC_FRONTEND.md](specs/SPEC_FRONTEND.md) | `apps/web` — Next.js, cliente OpenAPI, telas | Qualquer interface |
| [SPEC_DATA.md](specs/SPEC_DATA.md) | PostgreSQL + Drizzle: schema, migrations, criptografia | Tabelas, migrations, repositórios |
| [SPEC_QUEUE_PUBLISHING.md](specs/SPEC_QUEUE_PUBLISHING.md) | A spec mais crítica: fila, máquina de estados, retry, rate-limit, recuperação | Publicação, jobs, threads |
| [SPEC_INTEGRATIONS.md](specs/SPEC_INTEGRATIONS.md) | Contrato `ChannelProvider` e os adaptadores por rede | Adicionar ou ajustar uma rede social |
| [SPEC_API_MCP.md](specs/SPEC_API_MCP.md) | API REST pública + servidor MCP sobre os mesmos use-cases | Superfícies de máquina, auth, escopos |
| [SPEC_AI.md](specs/SPEC_AI.md) | IA de criação e IA operacional, sempre atrás de ports | Qualquer coisa de IA |
| [SPEC_INFRA.md](specs/SPEC_INFRA.md) | Redis, Docker, deploy, observabilidade | Compose, CI, métricas |
| [SPEC_ROADMAP.md](specs/SPEC_ROADMAP.md) | Fases de entrega e critérios de saída | Planejar a próxima fatia |

## `brand/` — identidade visual (normativo para UI)

| Arquivo | Papel |
|---|---|
| [BRAND_SYSTEM.md](brand/BRAND_SYSTEM.md) | **Fonte da verdade visual**: tokens de cor com contraste documentado, tipografia, botões, espaçamento |
| [BRAND_SYSTEM.html](brand/BRAND_SYSTEM.html) | O mesmo guia renderizado — abra no navegador |
| [brand/README.md](brand/README.md) | Avaliação do sistema e como adaptá-lo ao app (Next.js + shadcn/ui) |

**Regras que o CI verifica** (`bun run check:brand`): zero `box-shadow`, zero `translateY`/`scale`
no hover, cores só por token, radius apenas 4/6/8px, wordmark `manypost` sempre minúsculo.

## `references for postiz/` — referências visuais

Capturas de tela do Postiz usadas como referência de UX durante o desenho da interface.
Ver [o índice comentado](<references for postiz/README.md>) — inclui a nota sobre uso e autoria.

---

## Por que o planejamento também é público

O manypost é um **monorepo único 100% open source sob AGPL-3.0**, na mesma estratégia do Postiz:
não existe repositório privado, código fechado ou edição "enterprise" com features escondidas.
A fronteira entre o uso comunitário e o serviço gerenciado é feita **em tempo de execução**, por
variáveis de ambiente (`IS_SELF_HOSTED`, `HIDE_BILLING`) — o código é o mesmo dos dois lados.

Se o código é aberto, esconder o planejamento não protegeria nada e só tornaria a contribuição mais
difícil: quem chega precisa saber o que está pronto, o que falta e por que as coisas são como são.
Por isso `principal/` foi para dentro do repositório junto com as specs.

Ver [DECISIONS §15-16](principal/DECISIONS.md#adendo-v12-2026-07-17--monorepo-único-100-open-source-estratégia-postiz)
e [PLANS §2](principal/PLANS.md).

---

## Como manter esta documentação

- **Fatia entregue** → atualize [STATUS.md](principal/STATUS.md) e abra uma entrada nova no topo do
  [CHANGELOG_ONDAS.md](principal/CHANGELOG_ONDAS.md).
- **Decisão estrutural nova** → versão nova em [DECISIONS.md](principal/DECISIONS.md) com changelog;
  não edite decisão antiga no lugar, marque como superada.
- **Comportamento mudou** → a spec correspondente muda no **mesmo PR** do código.
- **Feature comercial nova** → precisa entrar no catálogo `packages/contracts/src/billing.ts` e em
  [PLANS.md](principal/PLANS.md), senão ela não existe comercialmente.
- **Gate de plataforma mudou de status** → [platform-gates.md](principal/platform-gates.md), em PR próprio.

**Nunca** documente segredos: chaves, tokens, IDs de conta de faturamento ou dados pessoais não
entram em nenhum arquivo daqui — nem em exemplo. Use marcadores (`sk_test_...`, `whsec_...`).
