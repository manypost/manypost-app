# test-kit — suíte de contrato de providers

Todo `ChannelProvider` deve passar pela mesma suíte antes do merge (SPEC_INTEGRATIONS §7):

1. `settingsSchema`/`connectionFieldsSchema` válidos e serializáveis para JSON Schema (OpenAPI).
2. `getAuthUrl` → URL válida com state; `exchangeCode` (HTTP mockado) → TokenSet completo.
3. `publish` mockado: sucesso mapeado; 429 → `transient`; 401 → `refresh-token`; corpo inválido → `permanent`.
4. `validateMedia` contra fixtures canônicas (dimensões, formato, contagem).
5. Golden tests do request body por rede (fixtures versionadas).

Implementação da suíte: fase 1 (junto com a onda 1 de providers).
