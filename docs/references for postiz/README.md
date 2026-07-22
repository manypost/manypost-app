# Referências visuais — capturas do Postiz

[← Índice da documentação](../README.md) · [SPEC_FRONTEND](../specs/SPEC_FRONTEND.md) · [Brand system](../brand/BRAND_SYSTEM.md) · [README do projeto](../../README.md)

> **Atenção: estas imagens NÃO são do manypost.** São capturas de tela do
> [Postiz](https://github.com/gitroomhq/postiz-app), usadas como **referência de UX** enquanto a
> interface era desenhada. Estão aqui para que qualquer pessoa entenda de onde vieram certas
> decisões de layout — e para deixar explícito o que foi seguido e o que foi propositalmente
> diferente. Direitos das imagens e da marca Postiz pertencem aos seus autores; o uso aqui é
> referencial, sem endosso ou afiliação. A derivação de código está declarada em
> [ATTRIBUTION.md](../../ATTRIBUTION.md) e analisada em
> [POSTIZ_ANALYSIS.md](../principal/POSTIZ_ANALYSIS.md).

## A direção que elas orientaram

A instrução de produto foi **"próximo do Postiz é inegociável, mas mais minimalista"**: reusar a
gramática de interação que já funciona (calendário como casa, composer com preview por rede,
personalização por provider) dentro do nosso [brand system](../brand/BRAND_SYSTEM.md) — zero
sombras, hierarquia por borda, cor só via token, nenhuma cor de rede social no layout.

| Imagem | O que ela mostra | Onde virou código no manypost |
|---|---|---|
| `0. oboarding e conexões individuais com previw no canto superior.png` | Onboarding e conexão de canais, com preview no canto | `/conexoes` — catálogo filtrado por credencial disponível, OAuth em popup |
| `1. visualização calendario sem nada, com providers a esquerda e outros botões.png` | Calendário vazio, painel de canais à esquerda | `/calendario` com `ChannelsPanel`; o calendário é a home do app |
| `2. calendario com um post agendado (no tema escuro).png` | Post agendado na grade | Grade dia/semana/mês com arrastar para reagendar (nosso app é light-only na v1) |
| `3. cofiguração de post moderna com popup, configurações por canal…png` | Composer em popup, settings por canal, preview global e por canal | `composer-modal.tsx` — diálogo grande, abas por canal, preview ao vivo |
| `4. validação indicados no canto do textarea junto dos demais botões…png` | Validação por rede junto do editor | Contador no canto do editor abrindo popover com toda a validação client-side |
| `5. varios comentarios junto do post, configurações mais faceis de entender.png` | Thread/comentários junto do post | Cartões empilhados com conector vertical, `delaySec` por item |
| `6.1 … 6.3` (Reddit: texto, link, imagem) | Configuração específica por rede | `settingsSchema` de cada provider renderizado genericamente no composer |
| `7. visualização por lista.png` | Visão em lista | Aba "Lista" do calendário, com filtros por estado na URL |
| `8. desbloquear personalização por provider.png` | Personalização por provider | Acordeão "Configurações de {canal}", gerado do JSON Schema do provider |
| `login.png`, `sing-in.png` | Telas de entrada | `/entrar` e `/cadastro` com o palco de marca em carrossel |

## O que fizemos diferente de propósito

- **Kanban** — não existe no Postiz; é design original nosso, com colunas por estado do grupo.
- **Zero sombras e hover sem deslocamento** — regra do brand system, verificada no CI
  (`bun run check:brand`).
- **Nenhuma cor de rede social no layout** — a identidade do canal vem do badge do provider e do
  formato do preview, não de pintar a interface com a cor da rede.
- **Light-only na v1** — a captura `2.` está no tema escuro do Postiz; o dark mode exige estender o
  brand system antes.

---

**Navegação:** [Índice da documentação](../README.md) · [SPEC_FRONTEND](../specs/SPEC_FRONTEND.md) · [Brand system](../brand/BRAND_SYSTEM.md) · [Análise do Postiz](../principal/POSTIZ_ANALYSIS.md) · [Atribuição](../../ATTRIBUTION.md) · [README do projeto](../../README.md)
