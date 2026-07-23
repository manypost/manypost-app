# AGENTS.md — `packages/db`

Aplicam-se também todas as regras do `AGENTS.md` da raiz. Este package é o
adaptador PostgreSQL/Drizzle; ele não decide regra de negócio nem chama provider,
fila ou HTTP.

## Estrutura e responsabilidade

- `src/schema/`: definição atual de tabelas, relações, índices e constraints;
- `src/repositories/`: implementação dos ports de `packages/core`;
- `src/migrate.ts`: execução de migrations e advisory lock;
- `migrations/`: histórico SQL append-only;
- `migrations/meta/`: metadata gerada pelo Drizzle Kit;
- `drizzle.config.ts`: entrada do gerador/check.

## Regras de dados

- Toda leitura/mutação de recurso de tenant deve receber `orgId` ou provar o
  escopo por join a um pai já filtrado.
- Um ID fornecido por request nunca é evidência suficiente de ownership.
- Constraint/índice deve refletir a invariável usada pelo caso de uso; não
  dependa apenas de validação na aplicação quando concorrência pode violá-la.
- Operações que mudam múltiplas tabelas de uma mesma invariável usam transação.
- Não faça chamada de rede ou enqueue dentro da transação. Retorne o resultado e
  programe o efeito após commit.
- Updates condicionais devem verificar se a linha foi alterada; não descreva uma
  operação como idempotente se o resultado da condição é ignorado.
- Valores de token/secret ficam como hash ou ciphertext conforme o schema; nunca
  logue ou devolva o valor persistido.

## Migrations

Nunca edite `migrations/000*.sql` ou `migrations/meta/*` existentes. Para uma
mudança aprovada no OpenSpec:

1. altere `src/schema/*.ts`;
2. gere com:

   ```bash
   bun run --cwd packages/db generate -- --name <nome-kebab-case>
   ```

3. leia todo SQL e metadata novos;
4. confirme lock, duração, backfill, tamanho de tabela e compatibilidade entre
   aplicação antiga/nova;
5. teste em PostgreSQL descartável com dados representativos;
6. execute:

   ```bash
   bun run --cwd packages/db check
   bun run check
   ```

`DB_MIGRATE=auto` roda no boot de produção. Por isso migrations precisam ser
compatíveis com rollout e rollback da aplicação. Remoção de coluna/tabela,
`NOT NULL` sem default/backfill, rewrite de tabela, enum destrutivo ou mudança
de chave exige plano expand/contract e aprovação humana explícita.

Não use produção para “validar” migration e não altere dados/volumes Railway
sem backup/restauração definidos.

## Testes mínimos

- Repository novo/alterado: teste caso feliz, organização errada, recurso
  ausente e condição concorrente/idempotente relevante.
- Transação: teste rollback quando uma etapa falha.
- Migration: banco limpo e banco no schema anterior.
- Query nova: revise índices e obtenha `EXPLAIN` em dataset representativo se
  estiver em hot path.

Ao mudar um port, atualize `packages/core`, todos os adapters/fakes e seus
testes no mesmo PR; não force dependência inversa do core para este package.
