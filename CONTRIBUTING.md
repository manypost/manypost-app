# Contribuindo para o manypost

Obrigado pelo seu interesse em contribuir para o **manypost**! 🎉 
Seja consertando um bug, adicionando uma nova funcionalidade ou melhorando a documentação, sua ajuda é muito bem-vinda.

Este é o nosso contrato técnico. Por favor, leia atentamente para garantir que seu Pull Request seja revisado e aceito rapidamente.

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
- Se você implementar lógicas derivadas do projeto original (Postiz), adicione o comentário:
  `// Derived from Postiz (AGPL-3.0): <caminho-original>`

Estamos felizes em ter você conosco na construção do melhor agendador open source! 🚀
