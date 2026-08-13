/**
 * Log estruturado da API: uma linha JSON por evento, no console correspondente ao nível.
 * Único ponto de saída dos `console.*` da aplicação — e nunca recebe payload que possa
 * conter token, cookie ou corpo externo sensível (AGENTS.md).
 */
export const log = (
  level: 'info' | 'warn' | 'error',
  msg: string,
  data?: Record<string, unknown>,
): void => {
  const line = JSON.stringify({ level, msg, ...data });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
};
