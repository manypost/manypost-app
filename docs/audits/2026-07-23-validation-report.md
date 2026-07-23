# Relatório de validação e entrega — 2026-07-23

## Estado

- Branch: `chore/maintenance-baseline-openspec`.
- Base: `main` no commit
  `aa382e85edceb57a3e35959d762c26e7fd971a82`.
- Pull Request: [#34](https://github.com/manypost/manypost-app/pull/34),
  apontando para `main`.
- CI inicial:
  [run 30044859292](https://github.com/manypost/manypost-app/actions/runs/30044859292),
  concluída com sucesso em 3m18s no commit
  `60bed4ff43303052292f465bef2c06106042aff7`.
- Commits antes deste relatório: 14, todos atribuídos a
  `Guilehrme <c0mbedforn1ght@gmail.com>`, a identidade já configurada no Git.
- Estado de merge observado: branch sem conflito, CI verde e aprovação humana
  obrigatória ainda ausente (`REVIEW_REQUIRED`).

O archive do change principal, o merge e a verificação do deploy permanecem
deliberadamente pendentes. A proteção de review não será contornada.

## Validações locais

| Validação | Resultado confirmado |
| --- | --- |
| clone lógico limpo em diretório temporário + `bun install --frozen-lockfile` | passou; 930 packages instalados |
| `bun run check:ci` no snapshot limpo | passou |
| `bun run check:ci` após as correções finais | passou |
| typecheck backend/packages e web | passou |
| `bun test` | 404 testes, 0 falhas, 1.036 assertions, 31 arquivos |
| dependency-cruiser | 407 módulos e 1.211 dependências, 0 violações |
| checks de providers IA e identidade visual | passaram |
| `drizzle-kit check` | passou |
| build Next.js 16.2.11 | passou; 14 rotas |
| `openspec validate --all --strict --no-interactive` | 3 changes válidos, 0 falhas |
| `git diff --check` | passou |
| autoria dos commits | todos usam a identidade Git configurada; nenhum coautor |

O build altera `apps/web/next-env.d.ts` para o path de produção gerado pelo
Next. O arquivo foi restaurado ao estado que o `next dev` gera, sem edição
manual.

## Validações remotas

O job `check` do PR confirmou no runner GitHub:

1. instalação congelada;
2. matriz `check:ci`;
3. build de `docker/Dockerfile`;
4. fronteira sem dependência do repositório premium;
5. E2E com API e worker reais, PostgreSQL, Redis e migrations no boot;
6. E2E de autenticação, publicação, API pública e MCP;
7. E2E de billing nos modos gerenciado e Community.

Todos os passos passaram. O runner emitiu uma annotation não bloqueante:
`actions/checkout@v4` declara Node.js 20 e foi forçada a executar em Node.js 24.
O acompanhamento foi registrado como L-06 no backlog, sem upgrade amplo nesta
entrega.

## Segurança e supply chain

- `bun audit` caiu de 17 advisories no baseline para 7 transitivos:
  4 altos e 3 moderados.
- Os advisories restantes e suas cadeias estão documentados; o comando continua
  retornando código diferente de zero e não é apresentado como aprovado.
- Semgrep OSS analisou 278 arquivos TypeScript/TSX e repetiu três findings
  informativos sobre o mesmo escape de texto do editor. A revisão não confirmou
  bypass no uso atual; L-05 registra a decisão.
- Semgrep Supply Chain não mapeou o workspace (`Workspace directory not found`);
  `bun audit` é a evidência SCA disponível.
- A busca de alta confiança no diff não encontrou segredo.
- O diff não contém binário nem arquivo acima de 1 MiB.
- Nenhum valor de variável Railway foi copiado para arquivos ou logs de
  documentação.

## Identidade legada

A busca final rastreada retorna:

- 328 linhas correspondentes em 71 arquivos;
- 406 matches individuais quando múltiplos usos na mesma linha são contados;
- 16 paths cujo nome contém o termo legado.

As 328 linhas estão classificadas no inventário: 82 de licença/atribuição e 246
históricas/processuais. Não há ocorrência residual indevida nas categorias de
substituição direta, refatoração técnica, compatibilidade ou decisão humana.
Nenhum identificador de runtime, banco, API, domínio operacional, e-mail, env
ou package legado foi confirmado.

## Limitações e pendências

- O daemon Docker local não estava disponível. O build da imagem foi comprovado
  no runner remoto.
- PostgreSQL e Redis locais via Docker também não estavam disponíveis. Todos os
  E2E existentes passaram no runner remoto com serviços reais.
- Não existe suíte E2E browser no repositório.
- O change principal não pode ser arquivado honestamente enquanto as tasks de
  merge/deploy estiverem abertas.
- O PR não pode ser mesclado pelo próprio autor enquanto a proteção exigir uma
  aprovação. No momento da consulta, o repositório só listava o próprio autor
  como colaborador; é necessária intervenção humana para conceder/recolher o
  review exigido.

## Próxima verificação obrigatória

Após uma aprovação válida:

1. confirmar CI verde no commit final, ausência de conflito e de comentário
   bloqueante;
2. marcar a task de archive, executar o archive pelo CLI local e validar as
   living specs;
3. publicar o commit de archive e aguardar a CI novamente;
4. fazer merge sem bypass;
5. confirmar o commit resultante em `main`;
6. acompanhar o deployment Railway, health e logs sem ler valores de segredo.
