# Changelog

Todas as mudanças relevantes do Manypost serão registradas neste arquivo.
O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e o projeto pretende seguir versionamento semântico quando publicar releases.

## [Unreleased]

### Added

- Canal **Instagram (Facebook Business)**: publica em conta profissional do Instagram
  vinculada a uma Página do Facebook, com a conta escolhida a cada post. Publica foto,
  reel, carrossel de 2 a 10 (misturando foto e vídeo) e story de mídia única; réplicas de
  thread saem como comentários. **Não exige credencial nova** — usa a mesma aplicação Meta
  do canal Facebook, então quem já configurou o Facebook só precisa registrar o redirect
  URI do novo callback. O token de publicação da Página é derivado a cada publicação e
  nunca é gravado em configurações, que são armazenadas sem cifra. Mudança OpenSpec:
  `add-instagram-facebook-business-provider`.

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

- A descoberta de Páginas da Meta (listagem direta mais Business Manager, paginada e
  deduplicada) passou a ter fonte única em `packages/providers/src/shared/meta-graph.ts`,
  compartilhada pelos canais Facebook e Instagram (Facebook Business), sem mudança de
  comportamento do Facebook.
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
- O web client permite que `/v1/auth/me` use a tentativa única de refresh e só abre
  `/v1/events` após confirmar a sessão; um 401 final chama logout para expirar
  também os cookies HttpOnly, remove `mp_session`, vai ao login e não inicia retry
  do EventSource.
- A conclusão do popup OAuth exige o `origin` do app e a janela popup
  efetivamente aberta.
- AES-256-GCM fixa explicitamente a tag de autenticação existente em 16 bytes
  tanto na cifra quanto na decifra.
- Advisories diretos do Next.js e do Drizzle ORM foram removidos pelo menor
  patch compatível validado.

### Security

- O audit caiu de 17 para 7 advisories transitivos. Permanecem 4 altos e 3
  moderados nas cadeias de Sharp/PostCSS, AJV/fast-uri, Redocly/js-yaml,
  Drizzle Kit/esbuild e MCP SDK/Hono; cadeia e exposição estão no
  [backlog](docs/audits/technical-backlog.md#advisories-de-dependências-restantes).
- Referências ao Postiz que permanecem são licença/atribuição ou
  história/proveniência. Nenhum identificador runtime legado foi encontrado;
  paths preservados e contagens constam no
  [inventário](docs/audits/postiz-reference-inventory.md).

### Known Issues

- Continuações concorrentes de thread e resultados externos indeterminados
  exigem fencing durável antes de qualquer mudança no publish.
- Media/webhook egress exige address pinning para fechar DNS rebinding.
- Exceções inesperadas dos handlers de fila podem ser reconhecidas como job
  concluído; refresh concorrente ainda não usa compare-and-swap.
- Uploads dependem de um volume Railway local sem restore automatizado testado;
  S3 ainda não possui adapter.
- Não há lint/formatter compartilhado nem E2E browser.

### Breaking Changes

- Nenhuma. Não houve mudança de API pública/MCP, banco, migration, cookies,
  prefixos, valores persistidos ou identificadores de provider.

### Operational Notes

- A imagem agora falha cedo se o lockfile ou build Next estiver inválido; isso
  pode transformar deploy antes “verde” em falha de build, por segurança.
- O daemon Docker local não estava disponível durante a validação inicial da
  branch; o build efetivo deve ser comprovado pela CI/Railway antes do merge.
- Rollback não requer mudança de dados: reverta os commits de runtime/CI ou
  redeploye o último commit Railway bem-sucedido.
