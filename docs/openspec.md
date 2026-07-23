# OpenSpec no Manypost

OpenSpec é o padrão deste repositório para propor, especificar, planejar,
implementar e arquivar mudanças materiais. A instalação é local e reproduzível:
`@fission-ai/openspec` está fixado exatamente em `1.6.0` no workspace e exige
Node.js `>=20.19.0`. Bun continua sendo o único gerenciador de pacotes do
projeto.

Fontes oficiais da versão adotada:

- [release 1.6.0](https://github.com/Fission-AI/OpenSpec/releases/tag/v1.6.0);
- [instalação](https://github.com/Fission-AI/OpenSpec/blob/v1.6.0/docs/installation.md);
- [CLI](https://github.com/Fission-AI/OpenSpec/blob/v1.6.0/docs/cli.md);
- [comandos e ciclo de mudança](https://github.com/Fission-AI/OpenSpec/blob/v1.6.0/docs/commands.md).

## Instalação e atualização

Para instalar exatamente o grafo versionado:

```bash
bun install --frozen-lockfile
bun run openspec --version
```

A segunda linha deve imprimir `1.6.0`. Não instale o OpenSpec globalmente para
trabalhar neste repositório.

Uma atualização é uma mudança de ferramenta e precisa de proposta/revisão:

```bash
bun add --dev --exact @fission-ai/openspec@<nova-versao>
bun run openspec init . --tools codex --profile core --force
bun run spec:validate
```

Revise as release notes e o diff dos arquivos gerados em `.codex/skills/`.
`bun.lock` deve ser alterado apenas pelo Bun. Os skills `openspec-*` devem ser
alterados apenas pelo comando de inicialização/atualização do OpenSpec.

## Estrutura

```text
openspec/
├── config.yaml              contexto e regras de artefatos
├── specs/                   requisitos vivos do sistema
└── changes/
    ├── <mudanca-ativa>/     proposta, design, deltas e tarefas
    └── archive/             mudanças concluídas

.codex/skills/openspec-*/    workflows gerados para agentes Codex
```

- Uma mudança ativa explica uma alteração ainda em planejamento ou execução.
- Os specs dentro dela são deltas que serão sincronizados no arquivo vivo.
- `openspec/specs/` representa o comportamento vigente depois do archive.
- O archive preserva a decisão e conclui o ciclo; não é uma exclusão.

## Quando abrir uma mudança

Abra ou atualize uma mudança antes de:

- adicionar ou alterar comportamento de usuário/API/MCP;
- modificar schema, migration, isolamento multi-tenant ou persistência;
- alterar provider, autenticação, filas, retry, idempotência ou webhook;
- modificar deploy, variáveis, observabilidade ou integração externa;
- fazer refatoração entre módulos ou mudar um contrato compartilhado;
- migrar identificadores Postiz que não sejam categoria 1 segura.

Uma correção ortográfica ou edição estritamente local e sem mudança de
comportamento pode dispensar uma nova mudança. O PR deve justificar a exceção e
continuar atualizando documentação/changelog quando aplicável.

## Criar e desenvolver uma mudança

Escolha um nome `kebab-case` orientado ao resultado:

```bash
bun run spec:new -- <nome-da-mudanca>
bun run spec:status -- --change <nome-da-mudanca>
```

Antes de escrever cada artefato, obtenha as instruções da versão instalada:

```bash
bun run openspec instructions proposal --change <nome-da-mudanca>
bun run openspec instructions specs --change <nome-da-mudanca>
bun run openspec instructions design --change <nome-da-mudanca>
bun run openspec instructions tasks --change <nome-da-mudanca>
```

Ordem normal:

1. `proposal.md`: motivação, escopo, capacidades e impacto;
2. `specs/<capacidade>/spec.md`: requisitos observáveis e cenários;
3. `design.md`: decisões, alternativas, riscos e rollout;
4. `tasks.md`: checklist pequeno, ordenado e verificável;
5. testes falhando antes de código quando há mudança de comportamento;
6. implementação, documentação e changelog;
7. validação e archive.

O `openspec/config.yaml` adiciona regras específicas do Manypost. Em especial:
preserve limites de packages, trate isolamento por organização, modele
falhas/retries externos, não copie segredos e classifique referências Postiz.

## Validar

Execute durante a autoria e antes de cada PR:

```bash
bun run spec:status -- --change <nome-da-mudanca>
bun run spec:validate
```

`spec:validate` equivale a:

```bash
openspec validate --all --strict --no-interactive
```

Não declare uma especificação válida se esse comando não foi executado. Um
requisito deve usar `SHALL` ou `MUST`, conter ao menos um cenário e usar
exatamente `#### Scenario:` nos cenários.

## Implementar

Antes de marcar uma tarefa:

1. leia proposta, design e requisitos relacionados;
2. confirme o owning module no mapa de arquitetura;
3. escreva o teste de regressão e confirme a falha esperada;
4. implemente o mínimo necessário;
5. rode o teste focado e as validações de impacto;
6. atualize docs e `CHANGELOG.md`;
7. marque a checkbox somente depois que a evidência existir.

Consulte o workflow Codex gerado em
`.codex/skills/openspec-apply-change/SKILL.md` quando um agente executar as
tasks.

## Concluir e arquivar

Verifique que todas as tarefas implementadas estão marcadas e que o diff
corresponde aos requisitos:

```bash
bun run spec:validate
bun run spec:archive -- <nome-da-mudanca> -y
bun run spec:validate
```

O archive sincroniza os deltas em `openspec/specs/` e move o registro para
`openspec/changes/archive/`. Inclua ambos os efeitos no commit. Se a
implementação foi abandonada, não a arquive como concluída: documente a decisão
ou remova a proposta em um PR revisável.

## Exemplo real desta iniciativa

`openspec/changes/establish-maintenance-baseline/` governa a própria adoção.
Ele contém:

- `repository-governance`: workflow, documentação e gates;
- `product-identity`: classificação segura Postiz → Manypost;
- `runtime-reliability`: correções confirmadas e testáveis.

Riscos maiores encontrados na auditoria recebem mudanças futuras separadas, em
vez de serem corrigidos sem design dentro desta iniciativa.
