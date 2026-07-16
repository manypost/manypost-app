/**
 * Dev de um comando só: `bun run dev:all`
 * Sobe os containers de dev (se existirem), a API (env do .env da raiz — o bun
 * carrega sozinho) e o web apontando pro PORT da API. Ctrl+C derruba os dois.
 */
import { spawn, type Subprocess } from 'bun';

// containers locais de dev — best-effort: se não existirem, siga (docker compose,
// serviço externo ou os `docker run` do STATUS.md §5 cobrem o resto)
await Bun.$`docker start mp-pg mp-redis`.quiet().nothrow();

const apiPort = process.env.PORT ?? '3100';
const webPort = process.env.WEB_PORT ?? '3000';
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
  // PORT do .env é da API — sem sobrescrever, o next dev herdaria e colidiria
  env: { ...env, PORT: webPort, API_URL: process.env.API_URL ?? `http://localhost:${apiPort}` },
});

console.log(`\n→ api  http://localhost:${apiPort}  (MODE=${process.env.MODE ?? '.env'})`);
console.log(`→ web  http://localhost:${webPort}\n`);

// no Windows, p.kill() não alcança os filhos (next dev fica órfão na porta 3000)
// — taskkill /T derruba a árvore inteira
const killTree = (p: Subprocess) => {
  if (p.killed || p.exitCode !== null) return;
  if (process.platform === 'win32') {
    Bun.spawnSync(['taskkill', '/PID', String(p.pid), '/T', '/F'], { stdout: 'ignore', stderr: 'ignore' });
  } else {
    p.kill();
  }
};
const stop = () => {
  killTree(api);
  killTree(web);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.on('exit', stop);

// um dos dois caiu = derruba o outro e sai com o mesmo status
const code = await Promise.race([
  api.exited.then((c) => {
    console.error(`\n✗ api saiu (código ${c}) — derrubando o web. Confira DATABASE_URL/REDIS_URL/PORT no .env e os containers (docker ps).`);
    return c;
  }),
  web.exited.then((c) => {
    console.error(`\n✗ web saiu (código ${c}) — derrubando a api. Porta 3000 ocupada? (netstat -ano | findstr :3000)`);
    return c;
  }),
]);
stop();
process.exit(code ?? 0);
