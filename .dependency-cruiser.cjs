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
      name: 'domain-puro',
      severity: 'error',
      from: { path: '^packages/core/src/domain' },
      to: { path: 'node_modules', pathNot: 'node_modules/(typescript|bun-types)' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
  },
};
