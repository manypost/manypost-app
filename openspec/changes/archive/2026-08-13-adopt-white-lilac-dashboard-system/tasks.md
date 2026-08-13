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

## 8. Ênfase das redes sociais

- [x] 8.1 Escrever testes que falhem para identidade legível de provider/conta nos cards de Conexões e chips de canal no Quadro; confirmar o RED.
- [x] 8.2 Implementar a nova hierarquia de identidade social sem alterar ações, dados ou superfícies neutras; confirmar o GREEN.
- [x] 8.3 Atualizar o contrato visual e changelog, executar validações relevantes, commitar, enviar a branch e redeployar no Coolify sem sincronizar ambiente.

## 9. Escala ampliada para seleção de rede

- [x] 9.1 Escrever testes que falhem para catálogo em quatro colunas, cards de 160px e tiles maiores de provider; confirmar o RED.
- [x] 9.2 Ampliar catálogo e contas conectadas usando o espaço disponível sem alterar os chips compactos do Quadro; confirmar o GREEN.
- [x] 9.3 Atualizar contrato visual e changelog, executar validações relevantes, commitar, enviar a branch e redeployar no Coolify sem sincronizar ambiente.

## 10. Hierarquia sem card aninhado no catálogo

- [x] 10.1 Escrever teste que falhe para logo direto de 56px, sem tile de fundo, e card externo de 144px; confirmar o RED.
- [x] 10.2 Remover o tile aninhado do catálogo e ajustar a escala do card externo sem alterar contas conectadas; confirmar o GREEN.
- [x] 10.3 Atualizar contrato visual e changelog, executar validações relevantes, commitar, enviar a branch e redeployar no Coolify sem sincronizar ambiente.

## 11. Escala compacta do catálogo de redes

- [x] 11.1 Escrever teste que falhe para cards de catálogo de 128px e logos diretos de 48px; confirmar o RED.
- [x] 11.2 Reduzir apenas o catálogo de redes, preservando a identidade oficial sem restaurar um card aninhado; confirmar o GREEN.
- [x] 11.3 Atualizar contrato visual e changelog, executar validações relevantes, commitar, enviar a branch e redeployar no Coolify sem sincronizar ambiente.

## 12. Resumos operacionais no modelo leve da Home

- [x] 12.1 Escrever teste que falhe para a composição clara do modelo 2 nos três resumos de hoje, sem variação fictícia; confirmar o RED.
- [x] 12.2 Reestruturar os resumos com ícone pastel, valor, textura pontilhada e superfícies de estado claras, preservando dados e links reais; confirmar o GREEN.
- [x] 12.3 Atualizar contrato visual e changelog, executar validações relevantes, commitar, enviar a branch e redeployar no Coolify sem sincronizar ambiente.
