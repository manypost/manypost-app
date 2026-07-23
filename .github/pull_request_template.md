## Contexto e objetivo

<!-- Problema, resultado esperado e issue relacionada. Remova "Fixes" se não houver issue. -->
Fixes #

## OpenSpec

- Mudança: `openspec/changes/<nome>` ou justificativa para exceção:
- Requisitos/cenários afetados:
- `bun run spec:validate`: <!-- resultado real -->

## Resumo das alterações

<!-- Descreva comportamento e decisões, não apenas nomes de arquivos/commits. -->

## Mapa dos arquivos principais

| Área/arquivo | Responsabilidade da alteração |
| --- | --- |
|  |  |

## Tipo e impacto

- [ ] Bug fix
- [ ] Feature
- [ ] Breaking change
- [ ] Documentação/governança
- [ ] Refactor sem mudança de comportamento
- [ ] Dependência/configuração
- [ ] Banco/migration
- [ ] Provider/integração externa
- [ ] CI/deploy/Railway

### Compatibilidade e identidade

- Breaking changes: <!-- "nenhum" ou contrato/migração -->
- Referências Postiz alteradas e categoria:
- Referências preservadas e motivo:
- API, valores persistidos, URLs ou identificadores afetados:

### Dados e infraestrutura

- Migration/schema: <!-- "nenhuma" ou arquivos, rollout e rollback -->
- Variáveis de ambiente: <!-- somente nomes e formatos; nunca valores -->
- Filas/cache/storage:
- Railway/deploy:

## Problemas encontrados

### Corrigidos

<!-- Evidência, localização, correção e teste. -->

### Não corrigidos

<!-- Severidade, impacto, recomendação/OpenSpec futuro. -->

## Validação executada

| Comando | Resultado |
| --- | --- |
| `bun install --frozen-lockfile` |  |
| `bun run check` |  |
| `bun run db:check` |  |
| `bun run build:web` |  |
| `bun run spec:validate` |  |
| testes/E2E adicionais |  |

Validação não executada, motivo e como reproduzir:

## Riscos e rollback

- Riscos/limitações:
- Observabilidade após deploy:
- Plano de rollback:

## Evidências visuais

<!-- Obrigatório para UI visual; remova a seção quando não aplicável. -->

## Checklist de revisão

- [ ] Li o `AGENTS.md` raiz e os arquivos de escopo aplicáveis.
- [ ] O diff corresponde aos requisitos e tasks OpenSpec.
- [ ] Escrevi primeiro um teste falhando para mudança de comportamento.
- [ ] Revisei isolamento por organização, autorização e tratamento de erro.
- [ ] Não adicionei segredo, dado pessoal ou artefato gerado/binário acidental.
- [ ] Não editei manualmente lockfile, OpenAPI gerado, metadata ou migration existente.
- [ ] Atualizei arquitetura/operação e `CHANGELOG.md`.
- [ ] Classifiquei referências Postiz sem substituição global.
- [ ] Registrei resultados reais; não marquei validação que não executei.
- [ ] Fiz auto-revisão do diff, autoria e commits.
- [ ] O PR aponta para `main`, está atualizado e não ignora proteção/revisão.
