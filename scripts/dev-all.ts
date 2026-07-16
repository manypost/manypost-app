/**
 * Dev de um comando só: `bun run dev:all`
 * Sobe os containers de dev (se existirem), a API (MODE via .env — o bun
 * carrega o .env da raiz sozinho) e o web apontando pro PORT da API.
 * Ctrl+C derruba os dois.
 */
import { spawn } from 'bun';

// containers locais de dev — best-effort: se não existirem, siga (docker compose,
// serviço externo ou os `docker run` do STATUS.md §5 cobrem o resto)
await Bun.$`docker start mp-pg mp-redis`.quiet().nothrow();

const apiPort = process.env.PORT ?? '3100';
const env = { ...process.env };

const api = spawn({
  cmd: ['bun', 'run', '--cwd', 'apps/api', 'dev'],
  stdout: 'inherit',
  stderr: 'inherit',
  env,
});
const web = spawn({
  cmd: ['bun', 'run', '--cwd', 'apps/web', 'dev'],
  stdout: 'inherit',
  stderr: 'inherit',
  env: { ...env, API_URL: process.env.API_URL ?? `http://localhost:${apiPort}` },
});

console.log(`\n→ api  http://localhost:${apiPort}  (MODE=${process.env.MODE ?? '.env'})`);
console.log('→ web  http://localhost:3000\n');

const stop = () => {
  api.kill();
  web.kill();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

// um dos dois caiu = derruba o outro e sai com o mesmo status
const code = await Promise.race([api.exited, web.exited]);
stop();
process.exit(code ?? 0);
