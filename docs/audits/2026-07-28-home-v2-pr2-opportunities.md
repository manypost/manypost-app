# Home v2 — oportunidades e recorte proposto para o PR2

> Documento de exploração, datado de 2026-07-28. Nenhum item abaixo está
> autorizado para implementação automática. O layout, a hierarquia final e
> qualquer comportamento novo devem ser apresentados ao owner antes do código,
> conforme combinado no PR #54.

## Objetivo

A Home atual responde principalmente “está tudo bem?” com agregados
operacionais. A próxima evolução deve responder também:

1. **O que acontece agora?**
2. **O que precisa da minha atenção?**
3. **Qual é o próximo passo mais útil?**

O ganho não deve vir de preencher a tela com métricas decorativas. Cada bloco
precisa oferecer contexto ou uma ação real e desaparecer quando não houver
sinal útil.

## Oportunidades para a `/inicio`

| Prioridade | Oportunidade | Resultado para o usuário | Impacto | Esforço | Fonte/dependência |
| --- | --- | --- | --- | --- | --- |
| P0 | **Próximas publicações** | Vê os próximos posts, horário, canal e estado sem abrir o calendário | Alto | M | Reusar o feed tipado de publicações; limitar a poucos itens e respeitar timezone |
| P0 | **Atividade recente curta** | Entende aprovações, falhas e mudanças relevantes desde a última visita | Alto | M | Reusar notificações; não duplicar a central completa nem exibir conteúdo sensível |
| P0 | **Próxima ação contextual** | Recebe um CTA coerente com o estado atual: conectar canal, corrigir falha, revisar ou criar post | Alto | P–M | Derivar do summary existente com prioridade determinística e testada |
| P0 | **Estados vazios por maturidade** | Primeiro uso orienta configuração; operação sem agenda orienta criação; operação saudável não mostra alarmes vazios | Alto | P–M | Reusar `firstRun` e sinais do summary; não inventar dados |
| P0 | **Ritmo da semana legível** | Entende rapidamente dias carregados ou vazios sem transformar a Home em outro calendário | Médio | P | Evoluir a semana já agregada; preservar visual compacto |
| P1 | **Rascunhos retomáveis** | Volta diretamente aos conteúdos inacabados mais relevantes | Alto | M | Definir ordenação, limite e regra para rascunhos antigos |
| P1 | **Sugestões de reaproveitamento** | Encontra conteúdo que pode ser adaptado para outro canal | Médio–alto | G | Exige critério explicável; não inferir desempenho sem métricas reais |
| P1 | **Atalhos personalizáveis** | Mantém na Home as ações mais usadas por cada perfil | Médio | M–G | Preferência por usuário, sincronização e fallback consistente |
| P2 | **Resumo de campanhas e desempenho** | Relaciona agenda a objetivos e resultados | Alto | G | Só depois de métricas e campanhas confiáveis; não usar contagem de publicação como performance |
| P2 | **Pulso da equipe** | Mostra revisões, aprovações e responsabilidades compartilhadas | Alto para agências | G | Depende de convites, papéis, autoria legível e isolamento por organização |

## Recorte recomendado para o segundo PR

O PR2 recomendado é **Home v2 orientada ao dia**, sem migration e sem nova
integração externa:

1. manter o cabeçalho, os agregados e os alertas operacionais atuais;
2. adicionar uma lista curta de **próximas publicações**, com no máximo cinco
   entradas e acesso ao post/calendário;
3. adicionar uma lista curta de **atividade recente**, reutilizando as
   notificações já escopadas pela organização;
4. escolher uma única **próxima ação contextual**, sem empilhar vários CTAs;
5. tratar loading, erro parcial, ausência de dados e primeiro uso por bloco;
6. validar desktop, mobile, teclado, contraste e reduced motion com E2E visual.

### Impacto e esforço esperados

| Dimensão | Avaliação |
| --- | --- |
| Impacto para o usuário | Alto |
| Esforço de produto/design | Médio |
| Esforço frontend | Médio |
| Esforço backend | Pequeno a médio, apenas se os feeds existentes não permitirem recorte seguro |
| Risco de dados | Baixo se não houver schema novo |
| Risco visual | Médio; exige aprovação prévia do layout e teste responsivo |

## Decisões que precisam de aprovação antes da implementação

- composição visual: duas colunas, uma coluna ou ordem adaptativa;
- quais blocos aparecem acima da dobra;
- quantidade máxima de próximas publicações e atividades;
- comportamento do clique e destino de cada entrada;
- prioridade entre conectar canal, corrigir falha, revisar e criar post;
- quanto movimento é aceitável e quais elementos podem animar;
- mockup final em desktop e mobile.

## Fora do PR2 recomendado

- analytics ou indicadores de desempenho sem ingestão de métricas;
- campanhas, templates, recorrência ou ações em lote;
- personalização persistida da Home;
- colaboração/equipe e matriz de permissões;
- IA operacional ou recomendações opacas;
- reestruturação da navegação ou da identidade visual.

## Critérios de pronto sugeridos

- nenhum dado cruza organizações;
- listas são limitadas, ordenadas de forma determinística e têm destino útil;
- falha de uma fonte não derruba os demais blocos;
- a Home não repete integralmente calendário ou notificações;
- estados vazios indicam um próximo passo real;
- layout aprovado pelo owner antes da implementação;
- testes focados, E2E visual responsivo, `bun run check` e
  `bun run build:web` aprovados.

