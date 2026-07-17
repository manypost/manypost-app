# Licença — AGPL-3.0 (100% Open Source Monorepo)

**✅ VALIDAÇÃO CONCLUÍDA (DECISIONS v1.1 §1c e Adendo Open Source):**
O pacote `@manypost/contracts` é parte integrante do monorepo e está licenciado sob **AGPL-3.0**, exatamente igual ao restante da aplicação (ver `/LICENSE` na raiz).

Como o projeto opera sob a estratégia de **Monorepo Único 100% Open Source** (sem repositórios privados paralelos ou módulos fechados `manypost-premium`), não há necessidade de dual-licensing permissivo para evitar herança de copyleft. A separação entre recursos comunitários (Self-Hosted) e serviço gerenciado na nuvem (Cloud / SaaS) ocorre de forma limpa via **variáveis de ambiente (`IS_SELF_HOSTED`, `HIDE_BILLING`)**, inspirada na arquitetura do Postiz.

- Todo o diretório permanece sob AGPL-3.0.
- O pacote mantém o foco em tipos, schemas e contratos — **zero lógica** de domínio (verificado por dependency-cruiser: `contracts-sao-folha`).
