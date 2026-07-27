/**
 * Fronteiras de arquitetura (SPEC_ARCHITECTURE §6, README "regras invioláveis").
 * CI falha se violadas.
 */
module.exports = {
  forbidden: [
    {
      name: 'core-nao-importa-apps',
      severity: 'error',
      from: { path: '^packages/core' },
      to: { path: '^apps' },
    },
    {
      name: 'core-nao-importa-infra',
      severity: 'error',
      comment:
        'domain/application dependem apenas de ports; adapters (db, providers, redis) ficam fora do core',
      from: { path: '^packages/core' },
      to: { path: '^packages/(db|providers)' },
    },
    {
      name: 'contracts-sao-folha',
      severity: 'error',
      comment:
        'contracts contém apenas tipos/schemas/constantes — não pode depender de nada interno (DECISIONS §1c)',
      from: { path: '^packages/contracts' },
      to: { path: '^(apps|packages/(core|db|providers|config))' },
    },
    {
      name: 'web-consome-api-via-openapi',
      severity: 'error',
      comment:
        'apps/web fala com o backend só pelo cliente OpenAPI gerado (SPEC_FRONTEND §1) — nunca importa pacotes internos de servidor',
      from: { path: '^apps/web' },
      to: { path: '^(apps/(api|worker)|packages/(core|db|providers|queue|config))' },
    },
    {
      name: 'ia-so-pelo-port',
      severity: 'error',
      comment:
        'domain/application chegam à IA SÓ pelo port AiProvider (SPEC_AI §2). Quem escolhe e ' +
        'constrói o adapter é o composition root — um use-case importando infra/ai amarraria o ' +
        'domínio a um protocolo, que é exatamente o que o check:ai-providers não consegue ver',
      from: { path: '^packages/core/src/(domain|application)' },
      to: { path: '^packages/core/src/infra/ai' },
    },
    {
      name: 'domain-puro',
      severity: 'error',
      comment: 'domain só enxerga contratos (shared kernel de tipos) e tipos do runtime',
      from: { path: '^packages/core/src/domain' },
      to: {
        path: 'node_modules',
        pathNot: 'node_modules/(typescript|bun-types|@types|@manypost[\\\\/]contracts)',
      },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '[\\\\/]\\.next[\\\\/]' },
    tsPreCompilationDeps: true,
  },
};
