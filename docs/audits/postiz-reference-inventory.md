# Inventário de identidade legada

## Resultado

A identidade de produto executável já era Manypost antes desta iniciativa:
wordmark, interface, títulos, metadata, packages internos, cookies, prefixo de
API key, logs próprios, domínios, projeto Railway, containers e rotas não
expunham Postiz como produto atual.

Foram removidas 31 menções comparativas desnecessárias em 19 arquivos de
configuração, comentários de UI/core e nomes de testes. Nenhuma substituição
global foi usada e nenhuma alteração de comportamento, persistência, API,
migration, asset ou identificador externo foi feita.

As menções preservadas documentam licença/atribuição ou história/proveniência.
Não foi encontrado identificador de runtime que exigisse refatoração,
compatibilidade ou decisão humana nesta entrega.

## Método e escopo

Buscas executadas somente em arquivos rastreados:

```bash
git grep -In -E 'postiz|Postiz|POSTIZ'
git grep -Il -E 'postiz|Postiz|POSTIZ'
git ls-files | rg -i 'postiz'
git grep -In -E 'postiz\.com|@postiz|postiz[_-]|POSTIZ_|postiz@'
```

Foram considerados:

- corpo de documentos e código;
- comentários e nomes de testes;
- nomes de arquivo/diretório;
- URLs e paths;
- packages, env, containers, telemetria, API, valores persistidos e migrations;
- variações de caixa e nomes compostos.

Imagens binárias foram classificadas pelo path e pelo índice textual em
`docs/references for postiz/`; seu conteúdo não foi alterado.

## Métricas da busca

| Momento | Ocorrências textuais | Arquivos |
| --- | ---: | ---: |
| baseline `main` antes da iniciativa | 298 | 71 |
| branch antes das substituições seguras | 340 | 85 |
| depois das substituições, antes deste inventário | 309 | 67 |
| após adicionar este inventário | 323 | 68 |
| branch final antes do Pull Request | 328 | 71 |

O aumento intermediário não foi rebranding regressivo: 42 menções foram
adicionadas pelo diagnóstico, OpenSpec, AGENTS e plano para governar e
documentar a migração. Elas são classificadas como registro histórico ou regra
de preservação.

As 14 ocorrências adicionadas pelo próprio inventário são categoria 5:
registrar o termo pesquisado é necessário para a auditoria permanecer
reproduzível.

Depois do inventário, cinco ocorrências processuais foram adicionadas:
duas no changelog, duas nas propostas de riscos futuros e uma no índice de
documentação. Elas não expõem identidade de produto; registram atribuição ou
apontam para esta auditoria e são categoria 5.

A busca por path retorna 16 arquivos. Quinze têm nome legado:

- `docs/principal/POSTIZ_ANALYSIS.md`;
- o diretório `docs/references for postiz/`, seu README e 13 imagens.

O décimo sexto é o próprio arquivo deste inventário, cujo nome descreve a
auditoria atual. Todos são categoria 5. Renomear os 15 históricos quebraria
links e apagaria contexto de proveniência sem benefício ao produto atual.

Na busca final, as 328 ocorrências se dividem em 82 de licença/atribuição
(categoria 4) e 246 históricas/processuais (categoria 5). As categorias 1, 2,
3 e 6 têm zero ocorrência residual indevida.

## Categorias

### 1. Pode ser substituída diretamente por Manypost

Nesta codebase, a maioria das ocorrências seguras não deveria ser substituída
literalmente por “Manypost”, e sim por uma descrição neutra do comportamento.
Isso evita transformar “paridade com o sistema de origem” em “paridade com o
próprio produto”.

| Grupo alterado | Menções removidas | Decisão |
| --- | ---: | --- |
| `.env.example` | 2 | descrever flags e modo Discord diretamente |
| shell/layout/CSS web | 3 | descrever posição/estilo sem referência comparativa |
| calendário web | 7 | documentar filtro, grade, slots e painel pelo comportamento |
| composer/previews web | 8 | documentar controles/layout e settings pelo comportamento |
| `packages/config/src/env.ts` | 5 | explicar defaults/gates atuais |
| core: scheduler/reschedule | 2 | explicar singleton key e job version |
| registry de providers | 1 | explicar chat versus feed |
| testes/auto-descoberta Discord/Telegram | 3 | nomear o comportamento testado |
| **Total** | **31** | **19 arquivos, zero comportamento alterado** |

Evidência: o diff muda comentários/JSDoc/descrições de teste e não altera
expressões executáveis, com exceção do texto interno do `describe`/`test`.

### 2. Requer refatoração técnica

**0 ocorrências confirmadas.**

Não há package import, símbolo TypeScript, cookie, route, database column, enum,
env, telemetria ou container de runtime com o nome legado. Se um desses
identificadores aparecer futuramente, ele deve receber OpenSpec próprio com
compatibilidade/migração.

### 3. Precisa permanecer por compatibilidade

**0 ocorrências de contrato de aplicação confirmadas.**

Paths e links com o nome legado foram classificados como história/proveniência
(categoria 5) ou atribuição (categoria 4), não como contrato runtime. Embora
renomeá-los quebrasse links, a razão primária para preservação é manter o
registro histórico.

### 4. Precisa permanecer por licença ou atribuição

82 das 309 ocorrências residuais anteriores a este relatório pertencem a esta
categoria.

| Arquivos/grupo | Contagem | Motivo | Risco de alteração | Recomendação |
| --- | ---: | --- | --- | --- |
| `ATTRIBUTION.md`, `NOTICE`, `CONTRIBUTING.md`, `README.md`, `CLAUDE.md` | 24 | autoria, fork, upstream estudado e regra AGPL | remover/falsear atribuição e quebrar links de origem | preservar; revisão jurídica separada para qualquer mudança |
| `packages/contracts/LICENSE.md` e comentários em `billing.ts`, `channel-provider.ts`, `enums.ts` | 6 | licença e derivação do shared kernel | perder proveniência de contrato/enum | preservar source path/commit |
| schemas `billing.ts`, `channels.ts`, `content.ts` | 3 | derivação documentada do modelo | apagar proveniência de dados | preservar; migrations antigas são imutáveis |
| core `plan-policy.ts` e `billing.ts` | 6 | comentários `Derived from` com fonte | apagar atribuição do comportamento | preservar enquanto a derivação for reconhecível |
| API billing/Stripe | 5 | comentários `Derived from` e divergências | omitir origem de implementação conceitual | preservar |
| sources de providers sociais | 35 | headers `Derived from`, source paths e divergências de corretude | perder atribuição e contexto que evita regressão/repost | preservar; atualizar somente se a implementação deixar de ser derivada, com revisão |
| `packages/providers/AGENTS.md` | 1 | obriga manutenção dos headers AGPL | novos ports podem remover atribuição por engano | preservar |
| declaração de origem em `AGENTS.md` | 1 | informa a natureza do fork | induzir manutenção/licenciamento incorreto | preservar |
| declaração de origem em `openspec/config.yaml` | 1 | injeta restrição de atribuição nos artefatos | agentes podem propor rename inseguro | preservar |
| **Total** | **82** |  |  |  |

Os demais usos de `AGENTS.md` e `openspec/config.yaml` são categoria 5 porque
tratam do processo/auditoria, não constituem por si só aviso de atribuição.

### 5. É histórica e não deve ser modificada

227 das 309 ocorrências residuais anteriores a este relatório pertencem a esta
categoria.

| Arquivos/grupo | Contagem | Motivo | Risco de alteração | Recomendação |
| --- | ---: | --- | --- | --- |
| `docs/principal/*` | 82 | decisões, status, gates e changelog do fork | reescrever fatos/cronologia e invalidar links | congelar fatos; adicionar correção datada, não reescrever |
| `docs/specs/*` anteriores ao OpenSpec | 85 | intenção/benchmark histórico | perder contexto arquitetural e atribuição conceitual | migrar requisito vivo gradualmente, preservar documento |
| `docs/references for postiz/README.md` | 8 | índice/autoria das capturas | descontextualizar 13 imagens de referência | preservar diretório e nota |
| documentação atual de navegação/auditoria | 21 | explica o que é histórico e como classificar | tornar a política impossível de aplicar/auditar | preservar; manter contagens atualizadas |
| plano e artefatos OpenSpec desta iniciativa | 26 | contrato e registro da migração | apagar evidência de decisão depois do archive | preservar no archive/spec vivo conforme o CLI |
| comentários de referência visual ainda explícitos | 3 | apontam diretamente para screenshots históricas usadas no design | perder justificativa visual | preservar até revisão humana do material de referência |
| testes de divergência Kick/Twitch | 2 | registram que o comportamento corrigido não repete falha conhecida do upstream | enfraquecer proteção contra regressão | preservar o contexto no nome do teste |
| **Total** | **227** |  |  |  |

“Documentação atual de navegação/auditoria” inclui `docs/README.md`, diagnóstico,
arquitetura, operação, PR template e as quatro ocorrências processuais restantes
do `AGENTS.md`. “Artefatos OpenSpec” inclui a parte processual de config,
proposal, design, spec de identidade, tasks, guia OpenSpec e plano de execução.

### 6. Exige decisão humana

**0 ocorrências pendentes.**

Uma decisão humana/jurídica seria obrigatória antes de:

- renomear/remover o diretório de referências ou a análise histórica;
- alterar licença, NOTICE, ATTRIBUTION ou regra `Derived from`;
- declarar que uma implementação deixou de ser derivada;
- remover upstream/source paths;
- migrar futuro identificador persistido ou externo.

Nenhuma dessas ações é necessária para apresentar Manypost como produto atual,
portanto não há bloqueio de identidade nesta entrega.

## Cobertura por superfície

| Superfície procurada | Resultado |
| --- | --- |
| interface, títulos, metadata e mensagens | nenhuma identidade antiga exposta; comentários comparativos seguros foram neutralizados |
| packages/símbolos/imports | packages internos usam `@manypost/*`; residual só atribuição |
| env e configuração | nenhuma variável `POSTIZ_*`; comentários seguros removidos |
| containers/Railway | nomes Manypost; nenhum serviço/container antigo |
| URLs/domínios/e-mails | nenhum `postiz.com`, email ou domínio operacional antigo |
| API/MCP/cookies/telemetria | nenhum identificador runtime antigo |
| banco/migrations/valores persistidos | nenhum identificador antigo confirmado; comentários de schema preservados |
| assets | marca atual já Manypost; imagens históricas preservadas no diretório de referência |
| testes/snapshots | nomes comparativos seguros removidos; dois testes de divergência histórica preservados |
| licença/avisos | preservados integralmente |

O upstream `gitroomhq/postiz-app`, seu commit estudado e source paths continuam
onde sustentam atribuição/história. Não foram encontrados `@postiz`, domínio
operacional `postiz.com`, env prefixada `POSTIZ_` ou package runtime legado.

## Impacto e não-impacto da migração

Alterações realizadas:

- comentários operacionais passaram a explicar o comportamento atual;
- nomes de dois suites/casos de teste deixaram de expor “paridade”;
- o inventário torna explícita a fronteira entre marca e proveniência.

Não alterado:

- comportamento, bundle e copy visível;
- IDs, rotas, cookies, API keys, enums ou banco;
- imagens/wordmark atuais;
- arquivos legais/históricos;
- source links e headers de derivação.

Não há breaking change nem ação de dados/deploy. Rollback é um revert normal do
commit; ele apenas restauraria comentários comparativos.

## Regra para mudanças futuras

Execute a busca rastreada e classifique a ocorrência antes de editar. Categoria
1 pode ser alterada junto ao código; categorias 2, 3 e 6 exigem OpenSpec/migração
ou aprovação; categorias 4 e 5 permanecem.

O PR deve informar categoria, paths, risco e busca residual. `bun run
check:brand` continua sendo o gate automatizado da identidade atual, mas não
substitui este inventário de proveniência.
