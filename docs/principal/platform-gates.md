# platform-gates.md — rastreio dos gates por plataforma

[← Índice da documentação](../README.md) · [STATUS](STATUS.md) · [Specs técnicas](../specs/) · [README do projeto](../../README.md)

> Requisito operacional da SPEC_INTEGRATIONS §4: release de provider é **bloqueado** enquanto o gate estiver pendente (checklist de PR). Processos abertos no dia 1 (fase 0) porque o lead time é o caminho crítico da onda 2.

| Plataforma | Gate | Status | Conta dev | App ID | Iniciado em | Notas |
|---|---|---|---|---|---|---|
| Mastodon | nenhum | ✅ livre | — | — | — | onda 1; app por instância registrado dinamicamente |
| Bluesky | nenhum (app password/OAuth) | ✅ livre | — | — | — | onda 1 |
| Discord | nenhum (bot + OAuth) | ✅ livre | ☐ | ☐ | ☐ | onda 1 |
| Telegram | nenhum (BotFather) | ✅ livre | ☐ | ☐ | ☐ | onda 1 |
| LinkedIn | member post aberto; Community Mgmt (orgs) exige programa de parceiro | ☐ pendente | ☐ | ☐ | ☐ | onda 1 (member); página corporativa pode escorregar p/ onda 2 |
| X (Twitter) | app aprovado no portal; custo de tier | ☐ pendente | ☐ | ☐ | ☐ | **BYO-Key no Self-Hosted (`IS_SELF_HOSTED=true`); absorvido no plano Pro do SaaS Cloud** (DECISIONS v1.1 §13 / PLANS §4) |
| Meta — Facebook Pages | App Review + Business Verification | ☐ App Review pendente — **travado no CNPJ**; **provider ✅ pronto (onda 16), rodando em Development Mode** | ☐ | ☑ (dev mode) | 2026-07-23 | **implementado**: OAuth `fb_exchange_token`, Página escolhida por post (sub-contas do Discord) com o token de Página **derivado no publish**, feed/álbum/reel/story/comentário. **Os três "Meta" saem no MESMO app/review/verificação** — ver ⬇ |
| Meta — Instagram | App Review (`instagram_content_publish`) | ☐ App Review pendente — **travado no CNPJ**; **as DUAS variantes ✅ prontas, rodando em Development Mode**: standalone/Instagram Login (onda 15) e via Facebook Business (onda 17) | ☐ | ☑ (dev mode) | 2026-07-23 | mídia precisa de URL pública (Meta faz *pull* — depende de storage público/S3-R2); **marco de abertura ao público criador BR**. `instagram-standalone` = Instagram Login (sem Página); `instagram` = via Página, **reusando a mesma app/`FACEBOOK_APP_*` do `facebook`** (conta IG resolvida por `instagram_business_account`) |
| Meta — Threads | Threads API (caso de uso próprio no app Meta) | ☐ App Review pendente — **travado no CNPJ**; **provider ✅ pronto (onda 11), rodando em Development Mode** | ☐ | ☑ (dev mode) | 2026-07-22 | **implementado**: OAuth token curto→longo, container→`threads_publish`, carrossel misto, réplicas nativas. Não exige Página do FB nem Portfólio p/ testar. Token de ~60 dias com renovação **reativa** — refresh proativo (`th_refresh_token` em cron) segue em aberto |
| TikTok | auditoria da Content Posting API (Direct Post) | ⏳ **em revisão (submetida 2026-07-18)** — provider ✅ pronto em sandbox | ☑ | ☑ (sandbox) | 2026-07-17 | onda 2; **provider implementado e testado em sandbox** (OAuth2 PKCE + Direct Post/inbox, FILE_UPLOAD de vídeo, PULL_FROM_URL de foto). **Formulário de auditoria ENVIADO em 2026-07-18** — aguardando revisão (~2–3 semanas). Sem aprovação os posts ficam privados (SELF_ONLY). **marco de abertura ao público criador BR** |
| YouTube | escopo **sensível** `youtube.upload` → verificação OAuth (marca + screencast) + quota | ☐ pendente | ☐ | ☐ | ☐ | onda 2; 10.000 units/dia por projeto e **upload = 1.600 units ⇒ ~6 vídeos/dia** por instalação. Aumento de quota é **auditoria separada** da verificação OAuth |
| Pinterest | trial → **standard access** (review com vídeo do fluxo) | ⏳ em revisão — owner iniciou (informado em 2026-07-22; data exata a confirmar) | ☐ | ☐ | ☐ | onda 2; **no trial, Pin/Board criados são sandbox — só o criador vê** (ou seja, sem standard o produto não serve). Semanas de fila e reprovação comum na 1ª rodada |
| Reddit | acesso aprovado por formulário + **uso comercial exige acordo pago** | ☐ pendente — ⚠️ **decisão de negócio, não só técnica** | ☐ | ☐ | ☐ | onda 2; free = 100 QPM por client OAuth e **só uso não-comercial**. SaaS pago sobre a chave grátis viola os termos ⇒ **Cloud precisa de commercial agreement (relatos de ~US$ 12k/ano)**; **self-hosted resolve com BYO-key** (chave do próprio usuário, uso pessoal) — mesmo desenho do X |
| Google Business Profile | formulário de acesso à API (GBP API contact form) | ☐ pendente | ☐ | ☐ | ☐ | onda 3; **resposta em até 14 dias**, quota padrão 300 QPM por API quando aprovado (teto rígido de 10 edições/min por ficha). Público diferente do resto (negócio local, não criador) |
| Slack | **nenhum p/ funcionar**; review só p/ listar no Marketplace | ☐ pendente | ☐ | ☐ | ☐ | **o gate mais barato da lista**: "Public Distribution" (instalar em workspaces de terceiros) é auto-serviço — exige OAuth2, HTTPS e checklist, **sem revisão da Slack**. Review só se quisermos aparecer no Slack Marketplace (algumas empresas só instalam app listado) |
| Dev.to (Forem) | nenhum | ✅ **entregue (onda 19)** | — | — | — | API key pessoal nas configurações do usuário (`api-key` no header) — **sem app, sem OAuth, sem review**. Foi o provider mais barato de todos, e o único que já nasce publicando em produção |
| Medium | ⛔ **API fechada para novas integrações** | ⛔ **inviável hoje** | — | — | — | A Medium **parou de emitir integration tokens** e arquivou o repositório da API ("no longer supported"). Só quem já tem token antigo publica. Implementar = provider que quase ninguém consegue conectar — **decidir se entra assim mesmo (paridade Postiz) ou fica fora** |
| Dribbble | registro auto-serviço; **uso comercial exige aprovação prévia** | ☐ pendente | ☐ | ☐ | ☐ | app em `dribbble.com/account/applications/new`, escopo `upload` p/ criar shot. Limites: 60 req/min e 1.440/dia por usuário; **48 shots/mês e 5/dia por conta**, e a conta precisa poder subir shot (`can_upload_shot`). Nicho (design), volume baixo |
| Twitch | nenhum — app auto-serviço no dev console | ✅ livre — **provider pronto (onda 12)** | ☐ | ☐ | 2026-07-22 | **não é feed**: manda **mensagem no chat** (`/helix/chat/messages`) ou **anúncio do canal** (`/helix/chat/announcements`), escopos `user:write:chat` + `moderator:manage:announcements`. Toda chamada leva `Client-Id` junto do bearer. A Twitch pede que a app declare só os escopos que usa, sob pena de suspensão |
| Kick | nenhum — app auto-serviço (OAuth 2.1 + PKCE) | ✅ livre — **provider pronto (onda 12)** | ☐ | ☐ | 2026-07-22 | idem: publica **mensagem no chat** (`/public/v1/chat`, escopo `chat:write`). API pública recém-aberta e **em iteração rápida** — risco de quebra maior que o das outras |

**Atualização:** editar esta tabela a cada mudança de status (PR próprio, revisão obrigatória).

## ⬇ Meta — o gate é de entidade jurídica, não de código

*Apurado em 2026-07-22.*

Os providers da Meta (Facebook Pages, Instagram nas duas variantes, Threads) compartilham **um app, um App Review e uma Business Verification** — o `instagram` via Facebook Business inclusive divide as mesmas `FACEBOOK_APP_*` do `facebook`. A verificação é obrigatória para *advanced access* — que é exatamente o que `instagram_content_publish` / `pages_manage_posts` publicando em conta de terceiro exigem. **Não há desvio técnico.**

- **A verificação é de negócio, não de pessoa.** A Meta pede documento de registro da empresa; no Brasil qualquer CNPJ ativo serve como documento, mas a atividade registrada precisa ser compatível com desenvolvimento de software — verifique isso com contabilidade antes de submeter, porque **se o registro cai, a verificação cai junto** e leva o app.
- **Ao preencher**: razão social, endereço e telefone precisam bater **caractere a caractere** com o registro oficial (não use nome fantasia). Divergência aqui reprova a submissão sem qualquer relação com o mérito do app.
- **Não bloqueia o desenvolvimento**: o Development Mode libera as permissões inteiras para contas com papel no app (dono + testers). Dá para implementar os três providers, rodar E2E e **gravar o screencast exigido na submissão** antes de a verificação existir. Ordem: implementar → screencast → habilitar a entidade → submeter.
- **Self-hosted não depende disso** (BYO-key, mesma decisão do X — [DECISIONS v1.1 §13](DECISIONS.md)): cada instância registra o próprio app Meta e faz o próprio review. Quem depende da verificação é só o manypost Cloud.

## ⬇ Escopo confirmado: toda rede com ícone em `apps/web/public/social` vira provider

*Definido pelo owner em 2026-07-22.* O conjunto de ícones do app **é** a lista de redes-alvo (as
mesmas que o Postiz implementa). São 18 redes + `Google.svg`, que é **login social** (já entregue,
não é canal de publicação). Situação de cada uma:

**Prontas — 12 redes / 14 providers** (o Discord tem dois — OAuth2+Bot e webhook — e o Instagram
também: Instagram Login e via Facebook Business): Mastodon · Bluesky · Telegram · Discord ×2 ·
LinkedIn · X · TikTok · Threads · **Instagram standalone** · **Instagram via Facebook Business** ·
**Facebook Pages** · **Twitch** · **Kick** (as duas últimas fora do conjunto original de ícones —
ver a seção adiante). **A família Meta está completa** desde a onda 17.

**Faltam 6** — em ordem de custo/benefício (esforço de código × gate × valor p/ o usuário BR).
O **Dev.to** era o #1 e foi entregue na onda 19: confirmou a previsão (zero gate, esforço baixo) e
entrou publicando em produção no mesmo dia, sem depender de nenhum processo externo:

| # | Rede | Gate | Esforço | Por que nesta posição |
|---|---|---|---|---|
| 1 | **Slack** | nenhum p/ funcionar | médio (~290 l.) | Distribuição pública é auto-serviço. Canal de *equipe* (não de criador) — bom p/ o plano Pro/times |
| 2 | **YouTube** | verificação OAuth + quota | alto (~640 l.) | Vídeo é caro (resumable upload) e a quota de ~6 uploads/dia limita o Cloud; BYO-key resolve no self-hosted |
| 3 | **Pinterest** | trial → standard (vídeo) | médio (~530 l.) | Já em revisão. **Sem standard access o Pin nasce invisível**, então implementar antes da aprovação só serve p/ gravar o vídeo da submissão |
| 4 | **Reddit** | acordo comercial p/ SaaS | médio (~510 l.) | ⚠️ Trava de **negócio**: no Cloud, cobrar por cima da chave grátis viola os termos. Só faz sentido como **BYO-key self-hosted** até existir decisão sobre o acordo pago |
| 5 | **Dribbble** | aprovação p/ uso comercial | baixo (~225 l.) | Nicho de design, teto de 5 shots/dia. Barato de escrever, público pequeno |
| 7 | **Medium** | ⛔ API fechada | baixo (~145 l.) | **Decidir antes de codar**: a Medium não emite mais token novo. Provider entregue hoje só funciona p/ quem tem token antigo |
| — | **Google Business Profile** | formulário de acesso | alto (~630 l.) | Fora da onda: público de negócio local, não de criador. Fica na fase 3 como já estava |

### Twitch e Kick — entregues na onda 12 (paridade com o Postiz)

*Verificado e implementado em 2026-07-22.* O Postiz tem os dois
(`twitch.provider.ts`, `kick.provider.ts`) e **o gate de ambos é o mais barato possível**: app
auto-serviço no console de desenvolvedor, sem revisão, sem verificação de empresa. O que eles
publicam, porém, não é feed:

- **Twitch** publica **mensagem no chat** (`POST /helix/chat/messages`) ou **anúncio do canal**
  (`/helix/chat/announcements`). Escopos `user:write:chat`, `user:read:chat`,
  `moderator:manage:announcements`.
- **Kick** publica **mensagem no chat** (`POST /public/v1/chat`, escopo `chat:write`), com OAuth
  2.1 + PKCE.

Ou seja: **nenhum dos dois tem feed de posts**. Chat é efêmero e só tem plateia enquanto a live
está no ar — mensagem agendada para um canal offline vai para uma sala vazia. **Decisão do owner
em 2026-07-22: entram assim mesmo, com as mesmas features e particularidades que o Postiz já
mapeou.** O que a nossa implementação fez de diferente (e é melhor):

- **Recusa da rede vira falha de verdade.** Twitch e Kick respondem **200 com `is_sent: false`**
  quando descartam a mensagem (modo seguidores-only, mensagem duplicada, chat travado). O Postiz
  marca `status: 'error'` e segue; aqui isso levanta erro com o `drop_reason`, senão o post
  apareceria como publicado sem nunca ter entrado no chat.
- **Zero mídia declarada nas capabilities** (`images/videos maxCount: 0`) — o composer barra o
  anexo no agendamento em vez de descartar na hora de publicar.
- **Preview de chat** no composer, deixando explícito para quem agenda que a mensagem cai na sala
  ao vivo.

Segue valendo a ressalva de produto: se um dia quisermos que isso seja realmente útil, o desenho
é "avisar no chat quando eu entrar ao vivo" — gatilho de evento, não horário no calendário.

**Duas decisões que ainda precisam do owner antes de virar código** (nenhuma é impedimento técnico):
1. **Reddit** — entra só como self-hosted/BYO-key, ou vamos atrás do commercial agreement para o Cloud?
2. **Medium** — entra por paridade com o Postiz mesmo sabendo que quase ninguém consegue token novo, ou fica fora da matriz (e o ícone sai do app)?

*Fontes da pesquisa (2026-07-22):*
[Medium API arquivada](https://github.com/Medium/medium-api-docs) ·
[Dribbble v2 — overview](https://developer.dribbble.com/v2/) e [shots](https://developer.dribbble.com/v2/shots/) ·
[Slack — distribuição](https://docs.slack.dev/distribution) e [guidelines do Marketplace](https://docs.slack.dev/slack-marketplace/slack-marketplace-app-guidelines-and-requirements/) ·
[Forem API v1](https://developers.forem.com/api/v1) ·
[Pinterest — access tiers](https://developers.pinterest.com/docs/getting-started/access-tiers/) ·
[Reddit Data API 2026](https://www.redditapis.com/blogs/reddit-data-api-2026) ·
[Google Business Profile — limites](https://developers.google.com/my-business/content/limits) ·
[YouTube — OAuth p/ apps web](https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps)

---

**Nesta pasta:** [Decisões](DECISIONS.md) · [Planos](PLANS.md) · [Setup das redes](INTEGRATIONS_SETUP.md) · [Análise do Postiz](POSTIZ_ANALYSIS.md) · [STATUS](STATUS.md) · [Histórico das ondas](CHANGELOG_ONDAS.md)

**Navegação:** [Índice da documentação](../README.md) · [Specs técnicas](../specs/) · [Marca](../brand/BRAND_SYSTEM.md) · [README do projeto](../../README.md) · [Contribuir](../../CONTRIBUTING.md)
