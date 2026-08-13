/**
 * Log estruturado do runtime de filas: uma linha JSON por evento, com `module: 'queue'`.
 * Único ponto de saída — adapters e runtime não chamam `console.*` direto, e payload que
 * possa conter token nunca entra aqui (AGENTS.md).
 */
export const queueLog = (level: string, msg: string, data?: object) =>
  console.log(JSON.stringify({ level, msg, module: 'queue', ...data }));
