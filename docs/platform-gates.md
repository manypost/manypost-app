# platform-gates.md — rastreio dos gates por plataforma

> Requisito operacional da SPEC_INTEGRATIONS §4: release de provider é **bloqueado** enquanto o gate estiver pendente (checklist de PR). Processos abertos no dia 1 (fase 0) porque o lead time é o caminho crítico da onda 2.

| Plataforma | Gate | Status | Conta dev | App ID | Iniciado em | Notas |
|---|---|---|---|---|---|---|
| Mastodon | nenhum | ✅ livre | — | — | — | onda 1; app por instância registrado dinamicamente |
| Bluesky | nenhum (app password/OAuth) | ✅ livre | — | — | — | onda 1 |
| Discord | nenhum (bot + OAuth) | ✅ livre | ☐ | ☐ | ☐ | onda 1 |
| Telegram | nenhum (BotFather) | ✅ livre | ☐ | ☐ | ☐ | onda 1 |
| LinkedIn | member post aberto; Community Mgmt (orgs) exige programa de parceiro | ☐ pendente | ☐ | ☐ | ☐ | onda 1 (member); página corporativa pode escorregar p/ onda 2 |
| X (Twitter) | app aprovado no portal; custo de tier | ☐ pendente | ☐ | ☐ | ☐ | **traga-sua-chave nos DOIS modos** (DECISIONS §6) |
| Meta — Facebook Pages | App Review + Business Verification | ☐ pendente | ☐ | ☐ | ☐ | onda 2; exige screencast do fluxo |
| Meta — Instagram | App Review (`instagram_content_publish`) | ☐ pendente | ☐ | ☐ | ☐ | onda 2; mídia precisa de URL pública; **marco de abertura ao público criador BR** |
| Meta — Threads | Threads API (mesmo app Meta) | ☐ pendente | ☐ | ☐ | ☐ | onda 2 |
| TikTok | auditoria da Content Posting API (Direct Post) | ☐ pendente | ☐ | ☐ | ☐ | onda 2; sem auditoria os posts ficam privados — **marco de abertura ao público criador BR** |
| YouTube | quota 10k units/dia; audit p/ aumento; verificação OAuth | ☐ pendente | ☐ | ☐ | ☐ | onda 2; upload = 1600 units |
| Pinterest | trial → standard access | ☐ pendente | ☐ | ☐ | ☐ | onda 2 |
| Reddit | sem review formal; rate 1 req/s | ✅ livre | ☐ | ☐ | ☐ | onda 2 (maxConcurrent=1) |
| Google Business Profile | formulário de acesso à API | ☐ pendente | ☐ | ☐ | ☐ | onda 3; processo lento |

**Atualização:** editar esta tabela a cada mudança de status (PR próprio, revisão obrigatória).
