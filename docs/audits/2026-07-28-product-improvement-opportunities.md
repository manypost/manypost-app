# Oportunidades de evolução do produto — 2026-07-28

> Fotografia datada do produto após a Home operacional e a integração do
> composer no PR #54. Este documento é um backlog de hipóteses, não uma fonte
> normativa nem uma autorização de implementação. Cada item escolhido exige
> validação com usuários, aprovação do owner e sua própria mudança OpenSpec.
>
> O relatório
> [`2026-07-27-home-e-evolucao-do-app.md`](2026-07-27-home-e-evolucao-do-app.md)
> preserva a análise que levou à primeira Home. Vários achados daquele dia já
> foram entregues; esta revisão parte do código e dos specs vivos atuais.

## Como ler a prioridade

- **P0 — próxima rodada:** melhora confiança, orientação ou qualidade percebida
  sem depender de uma plataforma externa.
- **P1 — expansão do produto:** cria fluxos de uso recorrente ou colaboração e
  pede desenho de comportamento, dados e autorização.
- **P2 — crescimento:** amplia inteligência, alcance ou escala, mas depende de
  fundações anteriores ou de gates externos.

Impacto estima valor para o usuário; esforço combina produto, frontend,
backend, dados, testes e operação. `P`, `M` e `G` significam pequeno, médio e
grande — não são estimativas de prazo.

## P0 — próxima rodada recomendada

| Oportunidade | Resultado para o usuário | Impacto | Esforço | Dependências / risco | PR sugerido |
| --- | --- | --- | --- | --- | --- |
| **Home v2 orientada ao dia** | Além das contagens, mostra os próximos posts com horário/canal e uma atividade recente curta; reduz a ida ao calendário e ao sino para responder “o que vem agora?” | Alto | M | Reusar feed e notificações sem duplicar o calendário; manter blocos ausentes quando não houver sinal | `feat: expandir home operacional` |
| **Busca global + paleta de comandos** | Encontra post, mídia, canal e rota pelo teclado; torna o app mais rápido conforme o volume cresce | Alto | M | Definir índice/endpoint com escopo por organização, atalhos acessíveis e autorização por resultado | `feat: adicionar busca global` |
| **Central de falhas e reconexão** | Agrupa falhas por causa, explica o próximo passo e permite retry seguro ou reconexão sem varrer o kanban | Alto | M–G | Respeitar estados incertos, retry condicional, idempotência e ações por canal; nunca oferecer retry cego | `feat: adicionar central de falhas` |
| **Cobertura E2E visual e de acessibilidade** | Evita regressões de contraste, proporção, overflow, foco e reduced motion nas telas críticas | Alto | M | Ambiente autenticado descartável, fixtures sem credenciais reais e baseline visual estável | `test: adicionar e2e web crítico` |
| **Estados de carregamento/erro mais contextuais** | Skeletons e erros explicam qual bloco falhou e permitem tentar de novo sem transformar a página inteira em um estado vazio | Médio | P–M | Padronizar sem esconder falhas de autorização ou inventar dados em cache | `fix: refinar estados assíncronos` |

### Ordem dentro do P0

1. **E2E visual/acessibilidade**, para criar a rede de proteção.
2. **Home v2**, por ser o ganho mais visível e reutilizar dados já existentes.
3. **Busca global**, que melhora todas as áreas sem depender de providers.
4. **Central de falhas**, com design próprio por envolver segurança de entrega.
5. **Estados assíncronos**, incorporados às fatias anteriores ou em PR pequeno.

## P1 — capacidades que aumentam recorrência e colaboração

| Oportunidade | Resultado para o usuário | Impacto | Esforço | Dependências / risco | PR sugerido |
| --- | --- | --- | --- | --- | --- |
| **Templates e biblioteca de ideias** | Reutiliza estruturas, mídia e configurações por rede em vez de começar cada post do zero | Alto | M | Versionamento do template, ownership por organização e distinção clara entre duplicar e criar modelo | `feat: adicionar templates de post` |
| **Fila recorrente e slots preferidos** | Mantém uma cadência por canal e encaixa conteúdo nos próximos horários livres | Alto | G | Recorrência já aparece no schema, mas exige regras de geração, edição futura, timezone, idempotência e fencing de jobs | `feat: adicionar agenda recorrente` |
| **Ações em lote** | Reagenda, cancela ou aplica uma ação a vários itens com menos repetição | Alto | M–G | Autorização item a item, transação quando houver invariantes e relatório de sucesso parcial | `feat: adicionar ações em lote` |
| **Convites, equipes e troca de organização** | Permite que agências trabalhem sem compartilhar credenciais e deixa os papéis visíveis | Alto | G | Membership existe, mas faltam convites, matriz de permissão, troca de org e testes negativos de isolamento | `feat: adicionar colaboração em equipe` |
| **Histórico de atividade legível** | Responde quem criou, alterou, aprovou, cancelou ou usou IA em um conteúdo | Médio–alto | M | Expor `audit_log` sem conteúdo sensível, com paginação e filtro por organização | `feat: expor histórico de atividade` |
| **Aprovação com conversa e versão** | Cliente comenta trechos, acompanha revisões e aprova a versão correta | Alto | G | Token público, expiração, autorização, versionamento de conteúdo e notificação; exige revisão de segurança explícita | `feat: evoluir aprovação de conteúdo` |

## P2 — inteligência, alcance e escala

| Oportunidade | Resultado para o usuário | Impacto | Esforço | Dependências / risco | PR sugerido |
| --- | --- | --- | --- | --- | --- |
| **Ingestão de métricas por uma rede** | Mostra alcance e engajamento reais e melhora sugestões de horário | Alto | G | Começar por um provider; definir tenant scope, atraso, rate limit, reconciliação e retenção antes da migration | `feat: ingerir métricas de um provider` |
| **Campanhas e relatórios** | Agrupa posts por objetivo/período e compara resultado sem planilhas externas | Alto | G | Depende de métricas confiáveis, modelo de campanha e regras para sucesso parcial entre redes | `feat: adicionar campanhas` |
| **IA operacional baseada em sinais reais** | Prioriza falhas, sugere reaproveitamento e resume campanhas com dados verificáveis | Médio–alto | G | Depende de métricas/comentários/DMs; manter BudgetGuard, explicabilidade e revisão humana | `feat: adicionar ia operacional` |
| **Novos providers priorizados por demanda** | Amplia onde o conteúdo pode ser publicado | Variável | M–G por rede | Gates legais/comerciais, formatos, idempotência e prova de campo específicos; seguir `platform-gates.md` | Um PR por provider |
| **Uploads diretos e processamento de mídia** | Melhora arquivos grandes, previews e desempenho da biblioteca | Médio | G | Presigned upload, validação pós-upload, thumbnail/probe, limpeza e compatibilidade com storage local/S3 | `feat: evoluir pipeline de mídia` |
| **Escala horizontal de sessões e mídia** | Prepara API/MCP e uploads para múltiplas instâncias | Médio no curto prazo, alto no crescimento | G | Store de sessão compartilhado, storage externo comprovado e rollout compatível entre versões | `refactor: preparar escala horizontal` |

## Melhorias visuais que podem acompanhar cada fatia

Estas ações não justificam sozinhas uma grande reestruturação, mas elevam a
qualidade quando aplicadas junto de um fluxo real:

| Ação | Impacto | Esforço | Regra |
| --- | --- | --- | --- |
| Hierarquia de título, descrição e ação consistente | Médio | P | Um único `PageHeader`; não duplicar `h1` |
| Hover, pressed, foco e transições de 150–250ms | Médio | P | Sem esconder foco; sem movimento de hover proibido pelo brand |
| Empty states com próximo passo específico | Alto | P | Não criar cartão vazio apenas para preencher espaço |
| Densidade adaptativa em tabelas, grids e timelines | Médio | P–M | Manter alvo interativo mínimo e testar mobile |
| Skeletons com a forma do conteúdo final | Médio | P | Evitar layout shift e spinner genérico |
| Motion de entrada discreto | Baixo–médio | P | Apenas opacity/transform e sempre suprimível por reduced motion |

## Critérios para escolher o segundo PR

O próximo PR deve escolher **uma** hipótese de produto e responder antes do
código:

1. Qual problema observável ela resolve e para qual perfil?
2. Que dados já existem e quais precisariam ser criados?
3. O que fica explicitamente fora do primeiro corte?
4. Como autorização e escopo por organização são provados?
5. Como falha, retry, concorrência e sucesso parcial aparecem, se aplicáveis?
6. Que evidência de usabilidade e operação define “pronto”?

Recomendação: fazer do segundo PR **Home v2 orientada ao dia**, precedida ou
acompanhada pelo primeiro E2E visual do app. É o maior ganho perceptível sem
depender de migration complexa, API externa ou mudança de identidade. O layout
e o conteúdo exatos ainda precisam de aprovação antes de qualquer alteração
significativa, conforme solicitado pelo owner.

## Itens deliberadamente não implementados neste PR

- novas seções ou dados na Home;
- busca, paleta de comandos ou navegação nova;
- central de falhas, batch, recorrência ou templates;
- convites, papéis ou troca de organização;
- analytics, campanhas, IA operacional ou novos providers;
- mudança estrutural de layout ou identidade visual.

O primeiro PR fica restrito a contraste, proporção, refinamento visual discreto
e documentação. Esta separação evita transformar polish em uma expansão sem
requisitos, testes ou rollback próprios.
