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
    Alternativa 100% self-hosted, moderna e de alta performance ao Buffer, Hootsuite, Hypefury e Later.<br />
    Compositor multi-canal, calendário + kanban, publicação durável com retry/rate-limit, aprovação de cliente, API pública e servidor MCP.
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

## 📋 Tabela de Conteúdos

- [Sobre o Projeto](#-sobre-o-projeto)
- [Demonstração](#-demonstração)
- [Tech Stack & Arquitetura](#-tech-stack--arquitetura)
- [Guia de Instalação Local](#-guia-de-instalação-local)
- [Estrutura do Monorepo](#-estrutura-do-monorepo)
- [Regras Invioláveis do Repositório](#-regras-invioláveis-do-repositório)
- [Conformidade Postiz & Atribuição AGPL-3.0](#-conformidade-postiz--atribuição-agpl-30)
- [Documentação & Links Úteis](#-documentação--links-úteis)

## 💡 Sobre o Projeto

O **manypost** reimplementa e evolui as melhores práticas de agendamento e automação em uma arquitetura de alta performance. Ele oferece tudo o que você precisa para gerenciar postagens, colaborar com sua equipe e automatizar publicações rodando na sua própria infraestrutura em apenas 3 containers leves.

- **📅 Agendamento & Publicação Multi-canal**: Crie e programe publicações para diversos canais a partir de um único lugar. Suporte completo a agendamentos por calendário ou fluxo Kanban.
- **🧵 Suporte Nativo a Threads (Fios)**: Crie sequências completas (`threads`) com atraso (`delaySec`) configurável entre cada comentário. O sistema gerencia o cursor de envio exatamente onde parou, garantindo **nunca repostar** itens já enviados em caso de falha.
- **🤝 Aprovação de Cliente sem Login**: Envie links públicos com expiração configurável (ex: 7 dias) para clientes aprovarem o preview exato do post com 1 clique (`DRAFT → SCHEDULED`).
- **🤖 Servidor MCP Nativo & API REST Pública**: Perfeito para automação com Agentes de IA (Claude, OpenClaw) e plataformas de fluxo de trabalho (N8N, Make.com).
- **🛡️ 100% Self-Hosted & Zero Dependências Ocultas**: Nenhum componente premium ou código fechado.
- **⚡ Fila de Jobs Durável & Rate-Limiter Atômico**: Publicação resiliente com retries exponenciais (`jitter + backoff`), taxonomia de erros e rate-limiting em janelas via scripts Lua no Redis.
- **🔐 Criptografia & Segurança de Ponta a Ponta**: Tokens e webhooks protegidos at-rest por `AES-256-GCM` com AAD. Rotação automática de refresh tokens.

## 🎥 Demonstração

<!-- Substitua o link da imagem abaixo por um GIF ou Screenshot real do seu app -->
<p align="center">
  <img alt="manypost Demo" src="https://via.placeholder.com/800x450.png?text=Adicione+um+GIF+ou+Screenshot+Aqui" width="800" />
</p>

## 🛠️ Tech Stack & Arquitetura

O `manypost` foi construído sobre uma **stack moderna e ultrarrápida**:

- **Runtime & Gerenciador**: [Bun](https://bun.sh/) (`>=1.2.0`) com pnpm/Bun workspaces (Monorepo)
- **API & HTTP Engine**: [Hono](https://hono.dev/) (leve, tipado, compatível com Web Standards e MCP)
- **Frontend / UI**: [Next.js 15](https://nextjs.org/) + React 19 + shadcn/ui + Tailwind CSS
- **Banco de Dados & ORM**: PostgreSQL 17 + [Drizzle ORM](https://orm.drizzle.team/)
- **Fila & Agendador Durável**: [`pg-boss`](https://github.com/timgit/pg-boss) diretamente no Postgres
- **Cache, Pub/Sub & Rate-Limit**: Redis (controle atômico em Lua + barramento em tempo real)
- **Arquitetura Core**: Domain-Driven Design puro (`packages/core`), sem acoplamento de I/O.

## 🚀 Guia de Instalação Local (Quick Start)

**1. Clone o repositório**
```bash
git clone https://github.com/manypost/manypost.git
cd manypost
```

**2. Instale as dependências**
```bash
bun install
```

**3. Configure as variáveis de ambiente**
```bash
cp .env.example .env
```

**4. Suba o ambiente (Banco e Redis)**
```bash
docker compose up postgres redis -d
```

**5. Inicie o servidor de desenvolvimento**
```bash
bun run dev:all
```
A API estará rodando na porta `:3000` (com explorador de API HTTP / MCP incluso).

Para rodar o projeto inteiro de uma vez (produção-like), use `docker compose up`.

## 🏗️ Estrutura do Monorepo

O repositório é organizado em workspaces bem definidos, seguindo rigorosas regras de encapsulamento:

```text
apps/api           Bun + Hono: API REST (/v1/*), Servidor MCP, webhooks e SSE
apps/worker        Bun: Consumidores de fila pg-boss (publicação, retry, scanner de zumbis)
apps/web           Next.js 15 + shadcn/ui: Interface visual (em desenvolvimento)
packages/core      DDD: Regras de negócio, entidades e use-cases (puro TS, sem I/O)
packages/db        Drizzle ORM: Schemas, migrations e repositórios concretos de banco
packages/providers Provedores de canais (1 pasta por rede: Mastodon, Telegram, Bluesky, etc.)
packages/contracts Tipos, contratos e schemas Zod públicos partilhados
packages/config    Validação tipada das variáveis de ambiente (Zod)
docker/            Manifestos Docker Compose self-host + observabilidade
docs/              Especificações técnicas, decisões arquiteturais e guias de setup
```

## 🔒 Regras Invioláveis do Repositório

Para manter o monorepo open source limpo e com alta manutenibilidade, seguimos 4 regras inegociáveis via automações de CI (`bun run check`):

1. **Monorepo 100% Open Source**: Todo o projeto é open source sob AGPL-3.0. Não existe repositório privado paralelo. A separação entre o modo comunitário e o SaaS Cloud opera via variáveis de ambiente.
2. **Pureza do Core (`packages/core`)**: O pacote de domínio não pode importar de `apps/*` nem de adaptadores de infraestrutura (verificado por `dependency-cruiser`).
3. **Isolamento de IA**: Nenhum provedor de Inteligência Artificial ou SDK de terceiro pode ser importado fora do módulo de infraestrutura designado.
4. **Rastreabilidade de Derivação**: Todo código reimplementado a partir de soluções originais do Postiz deve conter o comentário: `// Derived from Postiz (AGPL-3.0): <caminho-original>`.

## ⚖️ Conformidade Postiz & Atribuição AGPL-3.0

O núcleo do **manypost** é **derivado em conceito e arquitetura de soluções do [Postiz](https://github.com/gitroomhq/postiz-app)** (`AGPL-3.0`), analisado na revisão `84edda5b02ea4a0aa31263a6aa52bc02b50f109f`.

- **Reimplementação Moderna**: O `manypost` não é uma cópia literal (usamos Bun/Hono/Next.js/Drizzle ao invés do NestJS original), mas herdamos contratos de provedores sociais, fluxos de autenticação, taxonomia de erros e pipeline transacional de retry do Postiz.
- **Preservação de Licença (AGPL-3.0)**: Em total conformidade com a licença original e em respeito aos criadores do projeto upstream, **este repositório inteiro é disponibilizado sob a licença AGPL-3.0**.
- **Transparência Legal**: Veja o arquivo [`ATTRIBUTION.md`](ATTRIBUTION.md) e [`NOTICE`](NOTICE) para detalhes.

## 📚 Documentação & Links Úteis

Todo o conhecimento técnico do projeto está detalhadamente documentado:

- 🤝 **[Guia de Contribuição (CONTRIBUTING.md)](CONTRIBUTING.md)**: Regras de PRs, branches e commits.
- 📜 **[Código de Conduta (CODE_OF_CONDUCT.md)](CODE_OF_CONDUCT.md)**: Regras para a comunidade.
- 🧪 **[Guia Rápido de Testes](TESTING.md)**: Como clonar e testar tudo facilmente.
- 📊 **[Status do Projeto (docs/STATUS.md)](docs/STATUS.md)**: Funcionalidades verificadas e pendências.
- 🔌 **[Setup de Canais (docs/INTEGRATIONS_SETUP.md)](docs/INTEGRATIONS_SETUP.md)**: Como obter credenciais OAuth de cada rede social.
- 🧠 **[Decisões Arquiteturais (docs/DECISIONS.md)](docs/DECISIONS.md)**: Registro de decisões e arquitetura do projeto.
- ⚖️ **[Licença Completa (LICENSE)](LICENSE)**: Termos da AGPL-3.0.
