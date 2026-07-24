import { createE2EHuman } from './e2e-clerk';

/**
 * E2E do servidor MCP (SPEC_API_MCP §5/§7.3): fala o protocolo Streamable HTTP de verdade
 * (initialize → mcp-session-id → tools/list → tools/call) contra /mcp, autenticando por API key
 * com escopo `mcp`. Cobre: descoberta de tools, list_channels, schedule_post (origem MCP +
 * audit_log actor_type=MCP), get_post, e recusa de credencial sem o escopo. Requer API MODE=all.
 *
 * `BASE` = host do app (registro/canal/chave). `MCP_URL` = endereço do servidor MCP: com host
 * dedicado é a RAIZ dele (`https://mcp.dominio`); sem ele, `${BASE}/mcp`.
 */
const BASE = process.env.BASE_URL ?? 'http://localhost:3991';
const MCP = process.env.MCP_URL ?? `${BASE}/mcp`;
const DEDICATED_HOST = new URL(MCP).host !== new URL(BASE).host;

let failures = 0;
function check(cond: unknown, msg: string) {
  if (cond) console.log(`  ok: ${msg}`);
  else {
    failures++;
    console.error(`  FALHOU: ${msg}`);
  }
}

// ---- setup: identidade Clerk OWNER + canal fake + API key com escopo mcp ----
const { auth: clerkAuth } = await createE2EHuman('mcp');

const connect = await fetch(`${BASE}/v1/channels/connect`, { method: 'POST', headers: clerkAuth, body: JSON.stringify({ provider: 'fake' }) });
const stateCookie = connect.headers.get('set-cookie')?.split(';')[0] ?? '';
const cbq = new URL(((await connect.json()) as any).url).searchParams;
await fetch(`${BASE}/v1/channels/callback/fake?code=${cbq.get('code')}&state=${cbq.get('state')}`, { headers: { ...clerkAuth, cookie: stateCookie } });
const channel = ((await (await fetch(`${BASE}/v1/channels`, { headers: clerkAuth })).json()) as any[])[0];
check(channel?.provider === 'fake', 'setup: canal fake conectado');

const clerkBearerOnMcp = await fetch(MCP, { method: 'POST', headers: clerkAuth, body: '{}' });
check(
  clerkBearerOnMcp.status === 401,
  `bearer Clerk no MCP → 401 (veio ${clerkBearerOnMcp.status})`,
);
const clerkCookieOnMcp = await fetch(MCP, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    cookie: `__session=${clerkAuth.authorization.slice('Bearer '.length)}`,
  },
  body: '{}',
});
check(
  clerkCookieOnMcp.status === 401,
  `cookie Clerk no MCP → 401 (veio ${clerkCookieOnMcp.status})`,
);

async function createKey(name: string, scopes: string[]) {
  const res = await fetch(`${BASE}/v1/api-keys`, { method: 'POST', headers: clerkAuth, body: JSON.stringify({ name, scopes }) });
  return ((await res.json()) as any).apiKey as string;
}
const mcpKey = await createKey('e2e-mcp', ['mcp']);

// ---- cliente MCP Streamable HTTP (hand-rolled) ----
let sessionId: string | undefined;
const MCP_HEADERS = () => ({
  'content-type': 'application/json',
  accept: 'application/json, text/event-stream',
  authorization: `Bearer ${mcpKey}`,
  ...(sessionId ? { 'mcp-session-id': sessionId } : {}),
});
function parseBody(ct: string, body: string): any {
  if (!body) return null;
  if (ct.includes('text/event-stream')) {
    const data = body.split('\n').filter((l) => l.startsWith('data:')).pop();
    return data ? JSON.parse(data.slice(5).trim()) : null;
  }
  return JSON.parse(body);
}
async function rpc(id: number, method: string, params: unknown, key = mcpKey) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    authorization: `Bearer ${key}`,
    ...(sessionId ? { 'mcp-session-id': sessionId } : {}),
  };
  const res = await fetch(`${MCP}`, { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) });
  const sid = res.headers.get('mcp-session-id');
  if (sid) sessionId = sid;
  const msg = parseBody(res.headers.get('content-type') ?? '', await res.text());
  return { status: res.status, msg };
}
async function callTool(id: number, name: string, args: object) {
  const { status, msg } = await rpc(id, 'tools/call', { name, arguments: args });
  const text = msg?.result?.content?.find((x: any) => x.type === 'text')?.text;
  // erro de validação de input do MCP vem como texto simples (não-JSON) — parse defensivo
  let data: any;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = undefined;
  }
  // isError pode vir no result (tool) OU o request inteiro pode ter falhado (msg.error)
  return { status, msg, data, isError: !!msg?.result?.isError || !!msg?.error };
}

// ---- 1) initialize → sessão ----
const init = await rpc(1, 'initialize', {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'e2e-mcp', version: '1.0' },
});
check(init.status === 200, `initialize → 200 (veio ${init.status})`);
check(init.msg?.result?.serverInfo?.name === 'manypost', 'serverInfo.name = manypost');
check(!!sessionId, 'mcp-session-id devolvido no initialize');
await fetch(`${MCP}`, { method: 'POST', headers: MCP_HEADERS(), body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) });

// ---- 2) tools/list ----
const tools = await rpc(2, 'tools/list', {});
const toolNames: string[] = (tools.msg?.result?.tools ?? []).map((t: any) => t.name);
check(toolNames.includes('list_channels'), 'tools/list expõe list_channels');
check(toolNames.includes('schedule_post'), 'tools/list expõe schedule_post');
check(['get_post', 'update_post', 'cancel_post', 'upload_media_from_url'].every((n) => toolNames.includes(n)), 'tools/list expõe get/update/cancel/upload');

// ---- 3) list_channels ----
const chTool = await callTool(3, 'list_channels', {});
check(chTool.status === 200 && Array.isArray(chTool.data), 'list_channels → array');
check(chTool.data?.some((x: any) => x.id === channel.id && x.provider === 'fake'), 'list_channels traz o canal fake');

// ---- 4) schedule_post (origem MCP) ----
const future = new Date(Date.now() + 3_600_000).toISOString();
const sched = await callTool(4, 'schedule_post', { text: 'agendado via MCP', channelIds: [channel.id], publishAt: future });
check(sched.status === 200 && !sched.isError, 'schedule_post não retornou erro');
const groupId = sched.data?.id;
check(sched.data?.state === 'SCHEDULED', `grupo SCHEDULED (veio ${sched.data?.state})`);

// origem MCP visível no feed (via sessão Clerk) + get_post via MCP
const feed = (await (await fetch(`${BASE}/v1/publications`, { headers: clerkAuth })).json()) as any;
const feedItem = feed.items?.find((it: any) => it.groupId === groupId);
check(feedItem?.group.origin === 'MCP', `origin = MCP no feed (veio ${feedItem?.group.origin})`);

const got = await callTool(5, 'get_post', { groupId });
check(got.data?.id === groupId, 'get_post devolve o grupo agendado');

// ---- 5) validação de tool (uuid inválido → isError, não derruba a sessão) ----
const bad = await callTool(6, 'get_post', { groupId: 'nao-e-uuid' });
check(bad.isError || bad.status !== 200, 'get_post com id inválido → erro de tool (isError)');

// ---- 6) credencial SEM escopo mcp é barrada no /mcp ----
const noScopeKey = await createKey('e2e-mcp-noscope', ['posts:read']);
const denied = await rpc(99, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'x', version: '1' } }, noScopeKey);
check(denied.status === 403, `API key sem escopo mcp → 403 (veio ${denied.status})`);

// ---- 7) host dedicado: raiz E alias /mcp respondem; navegador vê página, não 401 ----
if (DEDICATED_HOST) {
  const origin = new URL(MCP).origin;
  const alias = await fetch(`${origin}/mcp`, {
    method: 'POST',
    headers: MCP_HEADERS(),
    body: JSON.stringify({ jsonrpc: '2.0', id: 200, method: 'tools/list', params: {} }),
  });
  check(alias.status === 200, `alias ${origin}/mcp responde (veio ${alias.status})`);
  await alias.body?.cancel();

  const landing = await fetch(origin, { headers: { accept: 'text/html' } });
  check(landing.status === 200, `navegação humana na raiz → página (veio ${landing.status})`);
  check(
    (landing.headers.get('content-type') ?? '').includes('text/html'),
    'a página do host mcp. é HTML (não um 401 cru)',
  );

  const restOnMcpHost = await fetch(`${origin}/v1/channels`, { headers: { authorization: `Bearer ${mcpKey}` } });
  check(restOnMcpHost.status === 404, `host mcp. não serve a API REST (veio ${restOnMcpHost.status})`);
}

// ---- 8) audit_log gravado com actor_type=MCP ----
// (checado fora do script via psql — aqui só sinalizamos o groupId p/ conferência)
console.log(`  info: grupo criado via MCP p/ conferência de auditoria: ${groupId}`);

console.log(
  failures ? `\n❌ ${failures} FALHA(S)` : `\n✅ TUDO OK (servidor MCP em ${MCP}${DEDICATED_HOST ? ' — host dedicado' : ''})`,
);
if (failures) process.exit(1);
