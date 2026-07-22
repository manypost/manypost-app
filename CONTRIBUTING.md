# Contribuindo para o manypost

[← README do projeto](README.md) · [Documentação](docs/README.md) · [Status e backlog](docs/principal/STATUS.md) · [Código de conduta](CODE_OF_CONDUCT.md) · [Licença AGPL-3.0](LICENSE)

Obrigado pelo seu interesse em contribuir para o **manypost**! 🎉 
Seja consertando um bug, adicionando uma nova funcionalidade ou melhorando a documentação, sua ajuda é muito bem-vinda.

Este é o nosso contrato técnico. Por favor, leia atentamente para garantir que seu Pull Request seja revisado e aceito rapidamente.

## 🧭 Antes de começar

O projeto é um **monorepo 100% open source sob AGPL-3.0** — inclusive o planejamento. Isso ajuda você:

1. **O que fazer** — o [STATUS.md](docs/principal/STATUS.md) lista o que já funciona (com prova) e o
   [backlog](docs/principal/STATUS.md#4-o-que-falta--em-ordem-sugerida-com-referências) traz o que
   ficou de fora de cada fatia entregue, com a spec de referência. Bom ponto de partida.
2. **Como as coisas devem ser** — cada área tem uma spec em [docs/specs/](docs/README.md#specs--especificações-técnicas).
   Se o código e a spec divergirem, um dos dois está errado: corrija o par no mesmo PR.
3. **Por que são assim** — as [decisões congeladas](docs/principal/DECISIONS.md) trazem a
   justificativa de cada escolha estrutural. Discordar é legítimo; abra uma issue antes de escrever
   código que as contrarie.
4. **Se for mexer em qualquer tela** — o [BRAND_SYSTEM.md](docs/brand/BRAND_SYSTEM.md) é obrigatório,
   e o CI verifica as regras (zero sombras, cores só por token, hover sem deslocamento).
5. **Se for adicionar uma rede social** — [SPEC_INTEGRATIONS](docs/specs/SPEC_INTEGRATIONS.md)
   descreve o contrato `ChannelProvider`, e existe um test-kit que valida qualquer provider novo.
   Confira também os [gates de plataforma](docs/principal/platform-gates.md).

## 🔄 Fluxo de Trabalho (Git Flow)

1. **Faça um Fork** do repositório original para a sua conta do GitHub.
2. **Clone** o seu fork para a sua máquina local:
   ```bash
   git clone https://github.com/seu-usuario/manypost.git
   cd manypost
   ```
3. **Crie uma branch** a partir da branch principal (`main`) para a sua alteração:
   ```bash
   git checkout -b feat/minha-nova-funcionalidade
   ```
4. **Faça Commit** das suas alterações (siga o padrão abaixo).
5. **Faça Push** da branch para o seu fork:
   ```bash
   git push origin feat/minha-nova-funcionalidade
   ```
6. **Abra um Pull Request (PR)** no repositório original.

## 🌿 Padrão de Nomenclatura de Branches

Sempre prefixe suas branches com o tipo de alteração. Isso nos ajuda a entender rapidamente o escopo do seu trabalho:

- `feat/`: Para novas funcionalidades (ex: `feat/integracao-threads`)
- `fix/`: Para correções de bugs (ex: `fix/erro-login-oauth`)
- `docs/`: Para atualizações apenas na documentação (ex: `docs/atualiza-readme`)
- `chore/`: Para tarefas de manutenção que não afetam código de produção (ex: `chore/atualiza-dependencias`)
- `refactor/`: Para refatorações de código que não adicionam funcionalidades nem consertam bugs.

## 📝 Padrão de Commits (Conventional Commits)

Nós usamos [Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/). Cada commit deve seguir um formato padronizado que ajuda a gerar changelogs automaticamente.

**Formato:**
```
<tipo>(<escopo opcional>): <descrição curta>
```

**Exemplos:**
- `feat(ui): adiciona animação no hero section`
- `fix(api): resolve erro 500 no webhook de retorno`
- `docs: corrige link quebrado no guia de testes`
- `chore: atualiza pacotes do bun`

## 🛠️ Padrão de Código e Qualidade

O projeto utiliza o **Bun** e um conjunto de ferramentas para garantir a qualidade do código. Antes de enviar seu código, você **deve** garantir que ele passe em todas as verificações.

Na raiz do projeto, execute:
```bash
bun run check
```
Este comando irá:
1. Verificar a tipagem do TypeScript (`typecheck` e `typecheck:web`).
2. Rodar os testes automatizados (`test`).
3. Verificar as fronteiras arquiteturais do monorepo (`check:boundaries`), garantindo que a camada `core` não importe detalhes de infraestrutura.
4. Executar outras validações personalizadas (`check:ai-providers`, `check:brand`).

**Regras Invioláveis:**
- Mantenha a separação de responsabilidades (DDD). O pacote `packages/core` é puro.
- Toda query filtra por `org_id` — o sistema é multi-tenant.
- Nenhum provedor de IA nominal fora de `infra/ai/*`.
- Se você implementar lógicas derivadas do projeto original (Postiz), adicione o comentário:
  `// Derived from Postiz (AGPL-3.0): <caminho-original>`

## 📝 Contribuindo com documentação

A documentação vive no mesmo repositório e sob a mesma licença do código — o índice completo está em
[docs/README.md](docs/README.md), que também explica [como manter cada tipo de documento](docs/README.md#como-manter-esta-documentação).
Em resumo:

- **Mudou comportamento?** A spec correspondente muda no **mesmo PR**.
- **Entregou uma fatia?** Atualize o [STATUS.md](docs/principal/STATUS.md) e abra uma entrada no topo
  do [CHANGELOG_ONDAS.md](docs/principal/CHANGELOG_ONDAS.md).
- **Decisão estrutural nova?** Versão nova em [DECISIONS.md](docs/principal/DECISIONS.md) — não
  reescreva uma decisão antiga, marque-a como superada.
- **Nunca** inclua segredos em documentação ou exemplos: chaves, tokens, ids de conta de faturamento
  ou dados pessoais. Use marcadores (`sk_test_...`, `whsec_...`). O repositório é público.

Correção de typo, tradução e melhoria de clareza também são contribuições valiosas — não precisa
abrir issue antes.

Estamos felizes em ter você conosco na construção do melhor agendador open source! 🚀

---

**Navegação:** [README do projeto](README.md) · [Documentação](docs/README.md) ·
[Status e backlog](docs/principal/STATUS.md) · [Specs técnicas](docs/README.md#specs--especificações-técnicas) ·
[Código de conduta](CODE_OF_CONDUCT.md) · [Atribuição](ATTRIBUTION.md) · [Licença](LICENSE)
