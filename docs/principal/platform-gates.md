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
| Meta — Facebook Pages | App Review + Business Verification | ☐ pendente — **travado no CNPJ** | ☐ | ☐ | ☐ | onda 2; exige screencast do fluxo. **Os três "Meta" saem no MESMO app/review/verificação** — ver ⬇ |
| Meta — Instagram | App Review (`instagram_content_publish`) | ☐ pendente — **travado no CNPJ** | ☐ | ☐ | ☐ | onda 2; mídia precisa de URL pública (Meta faz *pull* — depende de storage público/S3-R2); **marco de abertura ao público criador BR** |
| Meta — Threads | Threads API (caso de uso próprio no app Meta) | ☐ App Review pendente — **travado no CNPJ**; **provider ✅ pronto (onda 11), rodando em Development Mode** | ☐ | ☑ (dev mode) | 2026-07-22 | **implementado**: OAuth token curto→longo, container→`threads_publish`, carrossel misto, réplicas nativas. Não exige Página do FB nem Portfólio p/ testar. Token de ~60 dias com renovação **reativa** — refresh proativo (`th_refresh_token` em cron) segue em aberto |
| TikTok | auditoria da Content Posting API (Direct Post) | ⏳ **em revisão (submetida 2026-07-18)** — provider ✅ pronto em sandbox | ☑ | ☑ (sandbox) | 2026-07-17 | onda 2; **provider implementado e testado em sandbox** (OAuth2 PKCE + Direct Post/inbox, FILE_UPLOAD de vídeo, PULL_FROM_URL de foto). **Formulário de auditoria ENVIADO em 2026-07-18** — aguardando revisão (~2–3 semanas). Sem aprovação os posts ficam privados (SELF_ONLY). **marco de abertura ao público criador BR** |
| YouTube | quota 10k units/dia; audit p/ aumento; verificação OAuth | ☐ pendente | ☐ | ☐ | ☐ | onda 2; upload = 1600 units |
| Pinterest | trial → standard access (**auditoria obrigatória em 2026**) | ⏳ em revisão — owner iniciou (informado em 2026-07-22; data exata a confirmar) | ☐ | ☐ | ☐ | onda 2 |
| Reddit | ~~sem review formal~~ → **auditoria obrigatória em 2026**; rate 1 req/s | ⏳ em revisão — owner iniciou (informado em 2026-07-22; data exata a confirmar) | ☐ | ☐ | ☐ | onda 2 (maxConcurrent=1) |
| Google Business Profile | formulário de acesso à API | ☐ pendente | ☐ | ☐ | ☐ | onda 3; processo lento |

**Atualização:** editar esta tabela a cada mudança de status (PR próprio, revisão obrigatória).

## ⬇ Meta — o gate é de entidade jurídica, não de código

*Apurado em 2026-07-22.*

Os três providers da Meta (Facebook Pages, Instagram, Threads) compartilham **um app, um App Review e uma Business Verification**. A verificação é obrigatória para *advanced access* — que é exatamente o que `instagram_content_publish` / `pages_manage_posts` publicando em conta de terceiro exigem. **Não há desvio técnico.**

- **A verificação é de negócio, não de pessoa.** A Meta pede documento de registro da empresa; no Brasil qualquer CNPJ ativo serve como documento, mas a atividade registrada precisa ser compatível com desenvolvimento de software — verifique isso com contabilidade antes de submeter, porque **se o registro cai, a verificação cai junto** e leva o app.
- **Ao preencher**: razão social, endereço e telefone precisam bater **caractere a caractere** com o registro oficial (não use nome fantasia). Divergência aqui reprova a submissão sem qualquer relação com o mérito do app.
- **Não bloqueia o desenvolvimento**: o Development Mode libera as permissões inteiras para contas com papel no app (dono + testers). Dá para implementar os três providers, rodar E2E e **gravar o screencast exigido na submissão** antes de a verificação existir. Ordem: implementar → screencast → habilitar a entidade → submeter.
- **Self-hosted não depende disso** (BYO-key, mesma decisão do X — [DECISIONS v1.1 §13](DECISIONS.md)): cada instância registra o próprio app Meta e faz o próprio review. Quem depende da verificação é só o manypost Cloud.

---

**Nesta pasta:** [Decisões](DECISIONS.md) · [Planos](PLANS.md) · [Setup das redes](INTEGRATIONS_SETUP.md) · [Análise do Postiz](POSTIZ_ANALYSIS.md) · [STATUS](STATUS.md) · [Histórico das ondas](CHANGELOG_ONDAS.md)

**Navegação:** [Índice da documentação](../README.md) · [Specs técnicas](../specs/) · [Marca](../brand/BRAND_SYSTEM.md) · [README do projeto](../../README.md) · [Contribuir](../../CONTRIBUTING.md)
