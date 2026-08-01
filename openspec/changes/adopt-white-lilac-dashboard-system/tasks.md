## 1. Baseline e contrato

- [x] 1.1 Instalar dependências de forma reproduzível, registrar o baseline dos testes focados e auditar os componentes compartilhados e superfícies atuais.
- [x] 1.2 Validar os artefatos OpenSpec com `bun run spec:validate` antes da implementação.

## 2. Contrato visual test-first

- [x] 2.1 Escrever testes que falhem para os tokens branco/lilás, escala Inter compacta, raios por função, sombra exclusiva do tooltip e gradientes nomeados de visualização de dados; confirmar o RED.
- [x] 2.2 Implementar os tokens, utilitários e regras de validação visual compartilhados e confirmar o GREEN dos testes focados.

## 3. Shell responsivo test-first

- [x] 3.1 Escrever testes que falhem para sidebar de 181/64 px, topbar desktop de 59 px, drawer abaixo de `lg` e posse de busca, notificações e conta; confirmar o RED.
- [x] 3.2 Implementar sidebar, topbar, layout e primitives do shell branco/lilás preservando navegação, conta e acessibilidade.

## 4. Home e Quadro test-first

- [x] 4.1 Escrever testes que falhem para os resumos lilás/azul com dados reais da Home, rail secundário de 260 px e Quadro como superfície única sem capacidade fictícia; confirmar o RED.
- [x] 4.2 Implementar a Home no novo sistema, reutilizando apenas dados reais e estados existentes.
- [x] 4.3 Implementar o Quadro no novo sistema, preservando filtros, cinco estados, drag-and-drop, seleção, ações e responsividade.

## 5. Propagação do sistema

- [x] 5.1 Propagar tokens e primitives para calendário, composer, mídia, conexões, notificações, configurações e planos sem alterar contratos funcionais.
- [x] 5.2 Alinhar autenticação, onboarding, aprovação e OAuth quando aplicável, mantendo exceções explícitas de contexto.

## 6. Documentação e governança

- [x] 6.1 Atualizar `design.md` como contrato normativo branco/lilás e preservar o histórico de decisões de identidade.
- [x] 6.2 Atualizar documentação de marca, instruções de desenvolvimento, `CHANGELOG.md` e o estado desta mudança.

## 7. Validação, entrega e deploy

- [x] 7.1 Executar testes focados, `bun run check`, `bun run db:check`, `bun run build:web`, `bun run spec:validate`, `git diff --check` e validação Docker aplicável.
- [x] 7.2 Inspecionar a interface em desktop e mobile no navegador, verificando regressões visuais, console e fluxos públicos possíveis sem autenticação.
- [x] 7.3 Criar commit Conventional Commit na branch atual, enviar a branch e implantar no Coolify sem sincronizar ambiente, confirmando commit e saúde operacional.
