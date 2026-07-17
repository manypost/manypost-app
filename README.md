<div align="center">
  <br />
  <a href="https://github.com/manypost/manypost">
    <picture>
      <img alt="manypost logo" src="docs/brand/logo.png" width="280" />
    </picture>
  </a>
  <br />
  <p><strong>Seu agendador e publicador open source de posts para redes sociais</strong></p>
  <p>
    Alternativa 100% self-hosted, moderna e de alta performance ao Buffer, Hootsuite, Hypefury, Postiz e Later.<br />
    Compositor multi-canal, calendário + kanban, publicação durável com retry/rate-limit, aprovação de cliente por link, analytics, API pública e servidor MCP.
  </p>
</div>

<p align="center">
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-AGPL%203.0-purple.svg" alt="License AGPL 3.0">
  </a>
  <a href="https://bun.sh">
    <img src="https://img.shields.io/badge/Bun-%E2%89%A51.2.0-black?logo=bun" alt="Bun">
  </a>
  <a href="https://hono.dev">
    <img src="https://img.shields.io/badge/API-Hono-FF6F00?logo=hono" alt="Hono">
  </a>
  <a href="https://nextjs.org">
    <img src="https://img.shields.io/badge/Web-Next.js%2015-black?logo=next.js" alt="Next.js">
  </a>
  <a href="https://orm.drizzle.team">
    <img src="https://img.shields.io/badge/ORM-Drizzle-C5F74F?logo=drizzle" alt="Drizzle ORM">
  </a>
  <a href="TESTING.md">
    <img src="https://img.shields.io/badge/Status-Fase%201%20(API%20%2B%20Worker)-00C853" alt="Status">
  </a>
</p>

<h3 align="center"><strong><a href="TESTING.md">🚀 NOVO: Experimente o manypost na sua máquina agora com apenas 1 comando Docker! »</a></strong></h3>

<div align="center">
  <strong>
  O manypost oferece tudo o que você precisa para gerenciar postagens, colaborar com sua equipe e clientes, e automatizar publicações usando Agentes de IA via servidor MCP e API REST nativos — tudo rodando na sua própria infraestrutura em apenas 3 containers leves.
  </strong>
</div>

<br />

<div align="center">
  <!-- Ícones de redes sociais suportadas ou em arquitetura -->
  <img alt="Mastodon" src="https://postiz.com/svgs/socials/Mastodon.svg" width="32" title="Mastodon (Pronto & Testado)">
  <img alt="Discord" src="https://postiz.com/svgs/socials/Discord.svg" width="32" title="Discord (Pronto & Testado)">
  <img alt="Bluesky" src="https://postiz.com/svgs/socials/Bluesky.svg" width="32" title="Bluesky (Pronto & Testado)">
  <img alt="X / Twitter" src="https://postiz.com/svgs/socials/X.svg" width="32" title="X / Twitter (Arquitetura Pronta)">
  <img alt="Instagram" src="https://postiz.com/svgs/socials/Instagram.svg" width="32" title="Instagram (Arquitetura Pronta)">
  <img alt="Facebook" src="https://postiz.com/svgs/socials/Facebook.svg" width="32" title="Facebook (Arquitetura Pronta)">
  <img alt="YouTube" src="https://postiz.com/svgs/socials/Youtube.svg" width="32" title="YouTube (Arquitetura Pronta)">
  <img alt="LinkedIn" src="https://postiz.com/svgs/socials/Linkedin.svg" width="32" title="LinkedIn (Arquitetura Pronta)">
  <img alt="Reddit" src="https://postiz.com/svgs/socials/Reddit.svg" width="32" title="Reddit (Arquitetura Pronta)">
  <img alt="TikTok" src="https://postiz.com/svgs/socials/TikTok.svg" width="32" title="TikTok (Arquitetura Pronta)">
  <img alt="Threads" src="https://postiz.com/svgs/socials/Threads.svg" width="32" title="Threads (Arquitetura Pronta)">
  <img alt="Pinterest" src="https://postiz.com/svgs/socials/Pinterest.svg" width="32" title="Pinterest (Arquitetura Pronta)">
</div>

<p align="center">
  <br />
  <a href="docs/STATUS.md"><strong>Explore o Status do Projeto »</strong></a>
  ·
  <a href="TESTING.md"><strong>Guia Rápido de Testes »</strong></a>
  ·
  <a href="docs/INTEGRATIONS_SETUP.md"><strong>Setup de Canais OAuth »</strong></a>
  <br />
</p>

---

## ✨ Principais Funcionalidades

O `manypost` reimplementa e evolui as melhores práticas de agendamento e automação em uma arquitetura de alta performance:

- **📅 Agendamento & Publicação Multi-canal**: Crie e programe publicações para diversos canais a partir de um único lugar. Suporte completo a agendamentos por calendário ou fluxo Kanban.
- **🧵 Suporte Nativo a Threads (Fios)**: Crie sequências completas (`threads`) com atraso (`delaySec`) configurável entre cada comentário/resposta. O sistema gerencia o cursor de envio exatamente onde parou, garantindo **nunca repostar** itens já enviados em caso de falha transitória ou retry.
- **🤝 Aprovação de Cliente sem Login (`/public/approval/:token`)**: Envie links públicos com expiração configurável (ex: 7 dias) para seus clientes e colaboradores visualizarem o preview exato do post por rede social. O cliente aprova (`DRAFT → SCHEDULED`) ou solicita alterações com 1 clique.
- **🤖 Servidor MCP Nativo & API REST Pública (`/v1/*`)**: Perfeito para automação de ponta com Agentes de IA (**Claude, OpenClaw, Hermes**) e plataformas de fluxo de trabalho (**N8N, Make.com, Zapier**). Conecte seu assistente para agendar, editar ou consultar métricas de posts diretamente.
- **🛡️ 100% Self-Hosted & Zero Dependências Ocultas**: Nenhum componente premium ou código fechado é exigido no núcleo. O aplicativo roda leve na sua própria infraestrutura usando apenas 3 containers Docker (`app`, `postgres`, `redis`).
- **⚡ Fila de Jobs Durável (`pg-boss`) & Rate-Limiter Atômico (`Redis`)**: Publicação resiliente com retries exponenciais (`jitter + backoff`), taxonomia inteligente de erros (`transient / refresh-token / permanent`), e rate-limiting em janelas via scripts Lua no Redis que reagendam automaticamente sem consumir tentativas.
- **🔐 Criptografia & Segurança de Ponta a Ponta**: Tokens de canais e segredos de webhook protegidos at-rest por `AES-256-GCM` com AAD por chave natural. Rotação automática de refresh tokens com detecção e revogação em caso de reuso.
- **📦 Gestão Avançada de Mídia & Anti-SSRF**: Upload multipart com verificação real de tipo MIME por *magic bytes* (`sniff.ts`) e importação segura por URL com proteções anti-SSRF e limite de payload em streaming.

---

## 🛠️ Tech Stack

Diferente do ecossistema original em Node/NestJS, o `manypost` foi construído sobre uma **stack moderna e ultrarrápida**:

- **Runtime & Gerenciador**: [Bun](https://bun.sh/) (`>=1.2.0`) com pnpm/Bun workspaces (Monorepo)
- **API & HTTP Engine**: [Hono](https://hono.dev/) (leve, tipado, compatível com Web Standards e MCP)
- **Frontend / UI**: [Next.js 15](https://nextjs.org/) + React 19 + shadcn/ui + Tailwind CSS (em construção na fase atual)
- **Banco de Dados & ORM**: PostgreSQL 17 + [Drizzle ORM](https://orm.drizzle.team/) (migrations seguras e consultas tipadas sem overhead)
- **Fila & Agendador Durável**: [`pg-boss`](https://github.com/timgit/pg-boss) diretamente no Postgres
- **Cache, Pub/Sub & Rate-Limit**: Redis (controle atômico em Lua + barramento em tempo real `mp:rt:{orgId}`)
- **Arquitetura**: Domain-Driven Design (`packages/core`) com **zero acoplamento de I/O**, validado por CI via `dependency-cruiser`

---

## 🚀 Quick Start (Subindo com 1 comando)

Para ter o projeto completo rodando na sua máquina e testar os endpoints e exploradores de API, siga as instruções abaixo ou consulte nosso [Guia de Testes Simplificado (`TESTING.md`)](TESTING.md).

### Requisitos
- **Docker Desktop** instalado e rodando
- **Git** instalado

### Passo a Passo

```bash
# 1. Clone o repositório
git clone https://github.com/manypost/manypost.git
cd manypost

# 2. Suba o ambiente de desenvolvimento via Docker Compose
docker compose up
```

Na primeira execução, o Docker irá construir os containers e inicializar as migrations no PostgreSQL automaticamente.
Quando você vir a mensagem `manypost api (MODE=all) on :3000`, a aplicação estará pronta!

Acesse no seu navegador:
👉 **http://localhost:3000** — Página inicial e explorador de API HTTP / MCP.

---

## 🏗️ Estrutura do Monorepo

O repositório é organizado em workspaces bem definidos, seguindo rigorosas regras de encapsulamento e separação de responsabilidades:

```
apps/api           Bun + Hono: API REST (/v1/*), Servidor MCP, webhooks e SSE
apps/worker        Bun: Consumidores de fila pg-boss (publicação, retry, scanner de zumbis)
apps/web           Next.js 15 + shadcn/ui: Interface visual (em desenvolvimento)
packages/core      DDD: Regras de negócio, entidades e use-cases (puro TS, sem dependência de I/O)
packages/db        Drizzle ORM: Schemas, migrations e repositórios concretos de banco
packages/providers Provedores de canais (1 pasta por rede: Mastodon, Telegram, Bluesky, Discord, etc.)
packages/contracts Tipos, contratos e schemas Zod públicos partilhados
packages/config    Validação tipada das variáveis de ambiente (Zod)
docker/            Manifestos do Docker Compose self-host + observabilidade de referência
docs/              Especificações técnicas por camada, decisões arquiteturais e guias de setup
```

---

## 📚 Documentação & Guias

Todo o conhecimento técnico do projeto está detalhadamente documentado na pasta [`docs/`](docs/):

| Documento | Conteúdo |
|---|---|
| [**docs/STATUS.md**](docs/STATUS.md) | **Estado atual do projeto:** Tabela completa de funcionalidades verificadas por testes unitários e E2E, pendências e handoff. |
| [**TESTING.md**](TESTING.md) | **Guia prático sem tecniquês:** Como clonar, subir o Docker e testar a API no navegador. |
| [**docs/INTEGRATIONS_SETUP.md**](docs/INTEGRATIONS_SETUP.md) | **Guia passo a passo:** Como criar seus Apps e obter credenciais OAuth/API de cada rede social (Meta, X, Bluesky, Telegram, Discord, etc.). |
| [**docs/POSTIZ_ANALYSIS.md**](docs/POSTIZ_ANALYSIS.md) | Análise técnica do Postiz (commit `84edda5`) e mapa explicativo da derivação das soluções. |
| [**docs/DECISIONS.md**](docs/DECISIONS.md) | Registro de decisões arquiteturais v1 + adendo v1.1 + adendo Open Source v1.2 (monorepo unificado 100% aberto, fila, concorrência, rate-limit). |
| [**docs/PLANS.md**](docs/PLANS.md) | Matriz de planos do serviço gerenciado (Grátis/Pro/Premium) e controle por feature flags no monorepo 100% open source. |
| [**docs/specs/**](docs/specs/) | Especificações detalhadas por camada: Arquitetura, Backend, Frontend, Fila/Publicação, Integrações, Dados e MCP. |
| [**docs/brand/**](docs/brand/) | **Identidade Visual:** `BRAND_SYSTEM.md` e guia de cores semânticas e tokens da UI do manypost. |

---

## 🔒 Regras Invioláveis do Repositório

Para manter o monorepo open source puro, limpo e com alta manutenibilidade, seguimos 4 regras inegociáveis via automações de CI (`bun run check`):

1. **Monorepo 100% Open Source (Community vs Cloud)**: Todo o projeto (aplicação, workers, APIs e contratos) é open source sob a licença AGPL-3.0. Não existe repositório privado paralelo (`manypost-premium`). A separação entre o modo comunitário gratuito (Self-Hosted) e o serviço gerenciado (SaaS Cloud) opera de forma limpa via variáveis de ambiente (`IS_SELF_HOSTED`, `HIDE_BILLING`), no mesmo padrão do Postiz.
2. **Pureza do Core (`packages/core`)**: O pacote de domínio e use-cases (`packages/core`) não pode importar de `apps/*` nem de adaptadores de infraestrutura (verificado continuamente por `dependency-cruiser`).
3. **Isolamento de IA**: Nenhum provedor de Inteligência Artificial nominal ou SDK de terceiro pode ser importado fora do módulo `infra/ai/*` (verificado via análise estática de grep).
4. **Rastreabilidade de Derivação**: Todo código ou lógica diretamente reimplementada a partir de soluções do Postiz deve conter o comentário obrigatório: `// Derived from Postiz (AGPL-3.0): <caminho-original>`.

---

## ⚖️ Conformidade Postiz & Atribuição AGPL-3.0

O núcleo do **manypost** é **derivado em conceito e arquitetura de soluções do [Postiz](https://github.com/gitroomhq/postiz-app)** (`AGPL-3.0`), analisado na revisão `84edda5b02ea4a0aa31263a6aa52bc02b50f109f`.

### O que isso significa?
- **Reimplementação Moderna**: O `manypost` não é uma cópia literal de código-fonte (nossa stack utiliza **Bun, Hono, Drizzle ORM e Next.js** em vez do NestJS/Prisma original), mas herdamos orgulhosamente e reimplementamos contratos de provedores sociais, fluxos de autenticação, taxonomia de erros de publicação (`transient / refresh-token / permanent`) e o pipeline transacional de retry do Postiz.
- **Preservação de Licença (AGPL-3.0)**: Em total conformidade com a licença original e em respeito aos criadores e contribuidores do projeto upstream, **este repositório inteiro é disponibilizado sob a licença [AGPL-3.0](LICENSE)**.
- **Transparência Legal**: Para ver a lista detalhada de todos os elementos conceituais derivados do Postiz e como eles se mapeiam na nossa arquitetura, consulte [**`ATTRIBUTION.md`**](ATTRIBUTION.md) e [**`NOTICE`**](NOTICE).

---

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=manypost/manypost-app&type=date&legend=top-left)](https://www.star-history.com/#manypost/manypost-app&type=date&legend=top-left)

---

## 📄 Licença

Distribuído sob a licença [AGPL-3.0](LICENSE).  
© 2026 Contribuidores do manypost.  
Derivado e inspirado em soluções do Postiz © Gitroom Holdings Ltd. — veja o arquivo [`ATTRIBUTION.md`](ATTRIBUTION.md) para detalhes da atribuição original.
