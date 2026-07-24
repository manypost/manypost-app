# Changelog

Todas as mudanças relevantes do Manypost serão registradas neste arquivo.
O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e o projeto pretende seguir versionamento semântico quando publicar releases.

## [Unreleased]

### Added

- Canal **Dev.to**: publica **artigos** em Markdown, com título próprio, tags (até 4), endereço
  original (canonical) e a opção de publicar por uma organização, escolhida a cada post. A primeira
  imagem anexada vira a capa. **Não exige configuração nenhuma**: a conexão pede uma chave de API
  que o próprio usuário gera na conta dele, então a rede fica disponível em toda instalação —
  self-hosted ou gerenciada — assim que o código sobe. O título é obrigatório e é recusado **ao
  agendar**, não no horário marcado. Mudança OpenSpec: `add-devto-provider`.

- Canal **Instagram (Facebook Business)**: publica em conta profissional do Instagram
  vinculada a uma Página do Facebook, com a conta escolhida a cada post. Publica foto,
  reel, carrossel de 2 a 10 (misturando foto e vídeo) e story de mídia única; réplicas de
  thread saem como comentários. **Não exige credencial nova** — usa a mesma aplicação Meta
  do canal Facebook, então quem já configurou o Facebook só precisa registrar o redirect
  URI do novo callback. O token de publicação da Página é derivado a cada publicação e
  nunca é gravado em configurações, que são armazenadas sem cifra. Mudança OpenSpec:
  `add-instagram-facebook-business-provider`.

- Autenticação humana obrigatória pelo Clerk, com UI Manypost customizada para
  senha, verificação de email, Google e tarefas de sessão.
- Fluxos de callback e conclusão Clerk, matcher de proxy e configuração
  operacional para Google OAuth e Railway.
- Continuação segura para tarefas Clerk de organização, reset de senha e MFA.
- OpenSpec `1.6.0` como dependência local exata, com configuração, scripts,
  guia de criação/validação/implementação/archive e a mudança real
  `establish-maintenance-baseline`.
- Propostas OpenSpec completas para idempotência de publicação/thread e
  proteção de requisições externas contra DNS rebinding.
- `AGENTS.md` raiz e regras específicas para banco e providers, incluindo
  boundaries, segurança, migrations, testes, commits, PR e definição de pronto.
- Documentação canônica e navegável de arquitetura, mapa do repositório, fluxos,
  dados/infraestrutura, Railway e desenvolvimento.
- Diagnóstico inicial, inventário de identidade legada e backlog técnico
  priorizado com evidência, impacto e recomendação.
- Comando `bun run check:ci` para reunir typechecks, 404 testes, boundaries,
  checks próprios, Drizzle, build web e OpenSpec.

### Changed

- O erro de configuração inválida agora **diz qual campo** está errado. Antes o detalhe do
  erro trazia só a mensagem do validador (`Required`), sem o nome do campo, o que era
  inútil assim que um provider passou a ter campo obrigatório. Vale para agendar e editar.

- As configurações por canal do composer passaram a ter rótulo, explicação e opções em
  pt-BR para **todos** os campos de **todos** os providers. Antes, campo sem tradução caía
  no nome cru da variável (`suppressEmbeds`, `replyControl`, `announcementColor`) e a
  explicação vinha do `describe()` do schema, com jargão técnico e nomes de enum da API
  (`SUPPRESS_EMBEDS`, `BCP-47`, `PUBLIC`/`CONNECTIONS`, `accounts_you_follow`). Os textos
  existentes também foram reescritos em linguagem de quem usa o produto.
- Campo de configuração opcional e sem valor padrão pode nomear o comportamento de não
  escolher pela chave `composer.channelSettings.unset.<provider>.<campo>` (em X, "Qualquer
  pessoa" no lugar de "Padrão da rede"); sem a chave, o texto genérico continua valendo.
- A nota de cada rede no catálogo de conexões passou a usar o tooltip padrão do app e a
  mostrar apenas o texto explicativo do que a rede publica. A orientação específica do modo
  da instalação (chaves no `.env` em self-host, nada no gerenciado) continua no diálogo de
  conexão. O ícone "?" do cartão passou a usar accent com relevo, como os demais controles.
- A descoberta de Páginas da Meta (listagem direta mais Business Manager, paginada e
  deduplicada) passou a ter fonte única em `packages/providers/src/shared/meta-graph.ts`,
  compartilhada pelos canais Facebook e Instagram (Facebook Business), sem mudança de
  comportamento do Facebook.
- Clerk autentica toda requisição humana; a API Manypost continua responsável
  por usuário, organização, membership, role e autorização. Não existe sessão
  humana interna nem fallback de senha/social. API keys, MCP e OAuth de canais
  não mudaram.
- O CI cria sessões Clerk de teste com chave RSA efêmera e identidades em
  PostgreSQL descartável; os E2E não dependem mais do JWT humano removido.
- Bun fixado em `1.3.14`; CI e imagem usam instalação congelada pelo `bun.lock`.
- GitHub Actions passa a executar typecheck web, brand, build Next, build da
  imagem Docker e validação OpenSpec além das verificações anteriores.
- Docker e Railpack deixam de aceitar instalação ou build web com falha.
- Next.js atualizado de `16.2.10` para `16.2.11` e Drizzle ORM de `0.44.7`
  para `0.45.2`, mantendo contratos e schema.
- Trinta e uma menções comparativas seguras ao produto de origem foram
  neutralizadas em comentários/configuração/testes; a identidade executável já
  era Manypost.

### Fixed

- Conexões SSE agora têm timeout Bun de 30 segundos, acima do ping de 25
  segundos, evitando a desconexão observada no Railway.
- O web client anexa o token Clerk a toda chamada `/v1`; o EventSource usa o
  cookie Clerk `__session`. Um 401 encerra o Clerk, vai ao login e não inicia
  retry do stream.
- API REST pública e MCP aceitam somente API key `mp_live_` por bearer; bearer
  ou cookie Clerk não pode mais contornar os escopos de máquina.
- Respostas 401, 403, 429 e 5xx da Backend API Clerk são tratadas como
  indisponibilidade; somente usuário inexistente é uma identidade inválida.
- A conclusão do popup OAuth exige o `origin` do app e a janela popup
  efetivamente aberta.
- AES-256-GCM fixa explicitamente a tag de autenticação existente em 16 bytes
  tanto na cifra quanto na decifra.
- Advisories diretos do Next.js e do Drizzle ORM foram removidos pelo menor
  patch compatível validado.

### Security

- Autenticação humana e autenticação de máquina usam middlewares separados, com
  testes negativos HTTP para bearer e cookie Clerk nas superfícies REST/MCP.
- Corridas de provisionamento por subject/e-mail e rollback intermediário são
  exercitados contra PostgreSQL real no CI.
- O audit caiu de 17 para 7 advisories transitivos. Permanecem 4 altos e 3
  moderados nas cadeias de Sharp/PostCSS, AJV/fast-uri, Redocly/js-yaml,
  Drizzle Kit/esbuild e MCP SDK/Hono; cadeia e exposição estão no
  [backlog](docs/audits/technical-backlog.md#advisories-de-dependências-restantes).
- Referências ao Postiz que permanecem são licença/atribuição ou
  história/proveniência. Nenhum identificador runtime legado foi encontrado;
  paths preservados e contagens constam no
  [inventário](docs/audits/postiz-reference-inventory.md).

### Known Issues

- O CLI Clerk está autenticado, vinculado e aprovado pelo `clerk doctor`; o
  domínio Clerk de produção ainda aguarda DNS/SSL, e a URI Google exata e o
  teste browser autenticado dependem dessa ativação e do primeiro usuário.
- Continuações concorrentes de thread e resultados externos indeterminados
  exigem fencing durável antes de qualquer mudança no publish.
- Media/webhook egress exige address pinning para fechar DNS rebinding.
- Exceções inesperadas dos handlers de fila podem ser reconhecidas como job
  concluído; refresh concorrente ainda não usa compare-and-swap.
- Uploads dependem de um volume Railway local sem restore automatizado testado;
  S3 ainda não possui adapter.
- Não há lint/formatter compartilhado nem E2E browser.

### Breaking Changes

- Clerk é obrigatório e invalida as sessões humanas anteriores. Usuários
  existentes precisam criar/recuperar a identidade no Clerk com o mesmo email.
  Login, cadastro, OAuth social, exchange, refresh e logout internos foram
  removidos. Não houve migration destrutiva nem mudança na API pública/MCP ou
  no OAuth de canais.

### Operational Notes

- Produção exige chaves de uma instância Clerk de produção e credenciais Google
  customizadas. A URL de callback deve ser copiada da conexão Google no Clerk;
  as origens web canônicas são `https://app.manypost.com.br` e
  `http://localhost:3000` somente em desenvolvimento.
- A imagem agora falha cedo se o lockfile ou build Next estiver inválido; isso
  pode transformar deploy antes “verde” em falha de build, por segurança.
- O daemon Docker local não estava disponível durante a validação inicial da
  branch; o build efetivo deve ser comprovado pela CI/Railway antes do merge.
- Rollback não requer mudança de dados: redeploye o último release verificado.
  O release novo não contém fallback runtime.
