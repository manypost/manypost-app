# manypost BRAND & DESIGN SYSTEM · ESPECIFICAÇÃO OFICIAL v2.0

[← Índice da documentação](../README.md) · [Contrato visual completo](../../design.md) · [Guia de adaptação](README.md) · [SPEC_FRONTEND](../specs/SPEC_FRONTEND.md)

> Este arquivo resume a identidade do produto. Medidas, composição, responsividade, gráficos,
> Quadro, Home, checklist e código-base completos vivem no [`design.md`](../../design.md).

## 1. Identidade

O **manypost** é uma plataforma multi-tenant de agendamento e publicação multicanal. A interface
deve transmitir precisão, controle e leveza para equipes que trabalham diariamente com conteúdo.

O wordmark canônico é sempre **`manypost`** em caixa baixa na UI, `<title>`, e-mails e docs de
produto. Não reintroduza formas históricas com capitalização diferente.

Princípios:

1. informação real antes de decoração;
2. Inter compacta e hierarquia por escala, não por peso excessivo;
3. superfícies brancas, bordas finas e espaço negativo;
4. roxo com parcimônia e teal somente em dados;
5. sidebar cinza-preta como âncora do shell;
6. sombra somente no tooltip;
7. gradiente somente como codificação de dados;
8. hover estável e foco sempre visível.

## 2. Paleta normativa

| Token | Valor | Papel |
| --- | --- | --- |
| `--canvas` | `#D9DBDD` | fundo externo |
| `--main` | `#FDFDFD` | fundo central |
| `--surface` / `--paper` | `#FFFFFF` | cards e overlays |
| `--surface-2` | `#F5F5F5` | região recuada/selecionada |
| `--line` | `#EDEDED` | divisor e borda de card |
| `--line-strong` | `#8B8B8B` | limite acessível de controle/overlay |
| `--ink` | `#0C0F17` | texto principal |
| `--graphite` | `#74767C` | texto secundário |
| `--mist` | `#9B9DA2` | detalhe decorativo |
| `--accent` | `#7C56CD` | marca, ação, seleção, série principal |
| `--accent-hover` | `#6E44C7` | hover primário |
| `--accent-tint` | `#EDEEFC` | realce lilás |
| `--kpi-lilac` | `#EDEEFC` | KPI alternado |
| `--kpi-blue` | `#E6F1FD` | KPI alternado |
| `--data-2` | `#00866C` | teal acessível para texto/linha |
| `--data-2-bright` | `#00F3BC` | marca gráfica não textual |
| `--sidebar` | `#242629` | sidebar solicitada pelo owner |
| `--sidebar-hover` | `#303236` | active/hover da sidebar |
| `--sidebar-text` | `#F3F3F4` | texto principal da sidebar |
| `--sidebar-muted` | `#AEB1B5` | apoio da sidebar |

Hexadecimal não entra em componentes. `apps/web/src/app/globals.css` é a implementação canônica.

## 3. Estados de publicação

| Estado | Texto/ícone | Tint |
| --- | --- | --- |
| Rascunho | `--graphite` | `--surface-2` |
| Agendado | `--state-scheduled` | `--state-scheduled-tint` |
| Publicando | `--state-publishing` | `--state-publishing-tint` |
| Publicado | `--state-published` | `--state-published-tint` |
| Falhou | `--state-failed` | `--state-failed-tint` |
| Revisão | `--state-review` | `--state-review-tint` |

Estados são semânticos. Vermelho, verde e âmbar não entram como ornamento.

## 4. Tipografia

O produto autenticado usa Inter:

| Utility | Papel | Tamanho/peso |
| --- | --- | --- |
| `text-axis` | eixo | `10px/400` |
| `text-meta` | metadado | `11px/400–500` |
| `text-compact` | navegação/corpo | `13px/400–500` |
| `text-panel` | título de card | `15px/500` |
| `text-title` | H1 de página | `18px/500` |
| `text-figure` | KPI | `23px/500` |

- produto não usa `font-bold`;
- título não usa display nem tracking perceptível;
- números comparáveis usam `tabular-nums`;
- labels compactos não quebram;
- Plus Jakarta Sans fica restrita a marketing, auth e onboarding.

## 5. Geometria

### 5.1 Espaçamento

Escala: `4 / 8 / 12 / 16 / 20 / 24 / 28 / 32px`.

Gaps, paddings e agrupamentos usam o degrau coerente com a densidade. Margens negativas não
corrigem alinhamento.

### 5.2 Raios por função

| Utility | Valor | Uso |
| --- | ---: | --- |
| `rounded-key` | `4px` | badge/checkbox |
| `rounded-compact` | `5px` | chip de tecla |
| `rounded-tooltip` | `8px` | tooltip/microbarra |
| `rounded-control` | `10px` | botão/input/nav/tile |
| `rounded-card` | `11px` | card analítico/board |
| `rounded-kpi` | `12px` | KPI |
| `rounded-full` | pill | busca/avatar/ponto |

### 5.3 Bordas e sombras

- card: `1px solid var(--line)`;
- input e overlay usam `--line-strong` quando a borda é o único limite;
- superfícies persistentes não usam sombra;
- tooltip usa `--shadow-tooltip` e é a única exceção.

## 6. Shell

- sidebar desktop: `181px`, recolhida `64px`;
- sidebar: `#242629`; item ativo neutro `#303236`;
- topbar: `59px`, desktop e mobile, `#FDFDFD`, borda inferior;
- busca: `138 × 27px`, pill;
- abaixo de `1024px`, sidebar vira drawer;
- main: `#FDFDFD`, padding `16–24px`;
- rail secundário: `260px` somente com dados reais;
- `PageHeader` contém o único H1 da tela em `18px/500`.

## 7. Superfícies

### Card analítico

- branco, borda `#EDEDED`, raio `11px`, padding `20px`;
- título `15px/500`;
- zero sombra e zero gradiente.

### KPI

- lilás/azul/lilás;
- referência `238 × 96px`, raio `12px`, padding `20px`;
- sem borda e sem sombra;
- valor `23px/500`, tabular;
- tile de ícone branco `34 × 34px`, raio `10px`.

### Controles

- altura conforme `sm/md/lg` existente;
- raio `10px`;
- fills sólidos;
- outline de foco visível;
- hover só altera cor/borda/fundo.

## 8. Dados e gradientes

O roxo é a série principal. O teal é a série secundária e, em linhas, aparece tracejado. Gráficos
não têm gridlines visíveis e não exibem pontos em todas as amostras.

Gradientes permitidos:

- `.viz-active-bar`;
- `.viz-donut-segment`;
- `.viz-area-fill`.

Qualquer outro gradiente de fill em shell, botão, card, campo ou navegação é violação.

## 9. Home

- três KPIs do dia com dados reais;
- região principal + rail de `260px` no desktop;
- cards detalhados só aparecem quando há conteúdo;
- first run instrui em vez de mostrar zeros;
- nenhum alcance, impressão, audiência, seguidor, contato ou capacidade é inventado.

## 10. Quadro

- toolbar e cinco lanes em uma única superfície branca de raio `11px`;
- lanes separadas por linhas verticais;
- cabeçalhos `15px/500`, sticky, com contagens reais;
- cards brancos de raio `11px`, preview opcional e zero sombra;
- URL filters, densidade, seleção, drag, teclado, lote, retry, erro e confirmações permanecem;
- nunca mostra `n / capacidade` fictícia;
- rolagem horizontal em largura insuficiente.

## 11. Responsividade

- `>=1260px`: composição completa;
- `1024–1259px`: sidebar presente, rail pode empilhar;
- `768–1023px`: drawer, KPIs `2 + 1`, superfícies empilhadas;
- `<768px`: uma coluna, KPIs empilhados e touch targets críticos de `44px`.

## 12. Iconografia e movimento

- Lucide/Tabler/Phosphor regular, `15–17px`, stroke fino;
- sem preenchimento em massa;
- movimento respeita `prefers-reduced-motion`;
- hover nunca usa translate/scale/rotate;
- foco usa outline, não shadow ring.

## 13. Critérios de aceite

1. `design.md` e `globals.css` concordam.
2. Nenhum hex fora de `globals.css`.
3. Sombra somente no tooltip.
4. Gradiente somente em utilities de dados.
5. Raios apenas nos papéis documentados.
6. Produto em Inter compacta, sentence case, sem bold.
7. Home e Quadro usam somente dados e operações reais.
8. `bun run check:brand`, testes focados, build e inspeção responsiva passam.

## 14. Histórico

- v1.3: relevo por gradiente, revogado;
- v1.4: superfícies chapadas;
- v1.5: canvas quente, rail 208px, títulos display;
- v2.0: sistema branco/lilás, rail 181px, Inter compacta e sombra somente no tooltip.
