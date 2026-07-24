import { createE2EHuman } from './e2e-clerk';
import { createHash } from 'node:crypto';

/**
 * E2E OAuth MCP: discovery → DCR → authorize+consent (Clerk) → token PKCE →
 * schedule_post com Bearer mpo_. Mantém API-key path em e2e-mcp.ts.
 */
const BASE = process.env.BASE_URL ?? 'http://localhost:3991';
const MCP = process.env.MCP_URL ?? `${BASE}/mcp`;
const ISSUER = BASE.replace(/\/+$/, '');

let failures = 0;
function check(cond: unknown, msg: string) {
  if (cond) console.log(`  ok: ${msg}`);
  else {
    failures++;
    console.error(`  FALHOU: ${msg}`);
  }
}

function pkceS256(verifier: string) {
  return createHash('sha256').update(verifier, 'ascii').digest('base64url');
}

function randomVerifier() {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return Buffer.from(buf).toString('base64url');
}

const { auth: clerkAuth, orgId } = await createE2EHuman('mcp-oauth');

// canal fake para schedule_post
const connect = await fetch(`${BASE}/v1/channels/connect`, {
  method: 'POST',
  headers: clerkAuth,
  body: JSON.stringify({ provider: 'fake' }),
});
const stateCookie = connect.headers.get('set-cookie')?.split(';')[0] ?? '';
const cbq = new URL(((await connect.json()) as { url: string }).url).searchParams;
await fetch(
  `${BASE}/v1/channels/callback/fake?code=${cbq.get('code')}&state=${cbq.get('state')}`,
  { headers: { ...clerkAuth, cookie: stateCookie } },
);
const channel = (
  (await (await fetch(`${BASE}/v1/channels`, { headers: clerkAuth })).json()) as Array<{
    id: string;
  }>
)[0];
check(!!channel?.id, 'setup: canal fake');

// ---- discovery ----
const prmRes = await fetch(`${MCP}/.well-known/oauth-protected-resource`);
const prm = (await prmRes.json()) as {
  authorization_servers?: string[];
  scopes_supported?: string[];
};
check(prmRes.status === 200, `PRM → 200 (veio ${prmRes.status})`);
check(
  Array.isArray(prm.authorization_servers) && prm.authorization_servers.length > 0,
  'PRM lista authorization_servers',
);
check(
  prm.scopes_supported?.includes('mcp:read') && prm.scopes_supported?.includes('mcp:write'),
  'PRM scopes mcp:read/write',
);

const asRes = await fetch(`${ISSUER}/.well-known/oauth-authorization-server`);
const asMeta = (await asRes.json()) as {
  authorization_endpoint?: string;
  token_endpoint?: string;
  registration_endpoint?: string;
  code_challenge_methods_supported?: string[];
  client_id_metadata_document_supported?: boolean;
};
check(asRes.status === 200, `AS metadata → 200 (veio ${asRes.status})`);
check(asMeta.code_challenge_methods_supported?.includes('S256'), 'AS anuncia PKCE S256');
check(asMeta.client_id_metadata_document_supported === true, 'AS anuncia CIMD');
check(!!asMeta.registration_endpoint, 'AS anuncia registration_endpoint');

// ---- DCR ----
const redirectUri = 'http://127.0.0.1:9/callback';
const dcrRes = await fetch(`${ISSUER}/oauth/register`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    redirect_uris: [redirectUri],
    client_name: 'e2e-mcp-oauth',
  }),
});
const dcr = (await dcrRes.json()) as { clientId?: string };
check(dcrRes.status === 201, `DCR → 201 (veio ${dcrRes.status})`);
check(!!dcr.clientId, 'DCR devolve clientId');

const verifier = randomVerifier();
const challenge = pkceS256(verifier);
const state = 'e2e-state';

const authorizeUrl = new URL(`${ISSUER}/oauth/authorize`);
authorizeUrl.searchParams.set('response_type', 'code');
authorizeUrl.searchParams.set('client_id', dcr.clientId!);
authorizeUrl.searchParams.set('redirect_uri', redirectUri);
authorizeUrl.searchParams.set('code_challenge', challenge);
authorizeUrl.searchParams.set('code_challenge_method', 'S256');
authorizeUrl.searchParams.set('scope', 'mcp:read mcp:write');
authorizeUrl.searchParams.set('state', state);
authorizeUrl.searchParams.set('resource', MCP);

const authz = await fetch(authorizeUrl, { redirect: 'manual' });
const pendingCookie = authz.headers.getSetCookie?.()?.[0]?.split(';')[0]
  ?? authz.headers.get('set-cookie')?.split(';')[0]
  ?? '';
check(authz.status === 302 || authz.status === 303, `authorize → redirect (veio ${authz.status})`);
check(pendingCookie.includes('mp_oauth_pending'), 'authorize seta cookie pending');

const approveRes = await fetch(`${ISSUER}/oauth/consent/approve`, {
  method: 'POST',
  headers: {
    ...clerkAuth,
    'content-type': 'application/json',
    cookie: pendingCookie,
  },
  body: JSON.stringify({ orgId, scopes: ['mcp:read', 'mcp:write'] }),
});
const approved = (await approveRes.json()) as { redirectTo?: string };
check(approveRes.status === 200, `consent approve → 200 (veio ${approveRes.status})`);
check(!!approved.redirectTo, 'approve devolve redirectTo com code');

const code = new URL(approved.redirectTo!).searchParams.get('code');
check(!!code, 'authorization code presente');
check(new URL(approved.redirectTo!).searchParams.get('state') === state, 'state preservado');

const tokenRes = await fetch(`${ISSUER}/oauth/token`, {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code: code!,
    client_id: dcr.clientId!,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  }),
});
const tokens = (await tokenRes.json()) as {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
};
check(tokenRes.status === 200, `token → 200 (veio ${tokenRes.status})`);
check(tokens.access_token?.startsWith('mpo_'), 'access_token mpo_');
check(!!tokens.refresh_token, 'refresh_token presente');

// PKCE fail
const badPkce = await fetch(`${ISSUER}/oauth/token`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    grant_type: 'authorization_code',
    code: 'already-used-or-fake',
    client_id: dcr.clientId,
    redirect_uri: redirectUri,
    code_verifier: 'wrong',
  }),
});
check(badPkce.status === 401 || badPkce.status === 400, `PKCE/código inválido → 4xx (veio ${badPkce.status})`);

// ---- MCP com mpo_ ----
let sessionId: string | undefined;
async function rpc(id: number, method: string, params: unknown) {
  const res = await fetch(MCP, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${tokens.access_token}`,
      ...(sessionId ? { 'mcp-session-id': sessionId } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
  const sid = res.headers.get('mcp-session-id');
  if (sid) sessionId = sid;
  const ct = res.headers.get('content-type') ?? '';
  const body = await res.text();
  let msg: unknown = null;
  if (body) {
    if (ct.includes('text/event-stream')) {
      const data = body.split('\n').filter((l) => l.startsWith('data:')).pop();
      msg = data ? JSON.parse(data.slice(5).trim()) : null;
    } else {
      msg = JSON.parse(body);
    }
  }
  return { status: res.status, msg };
}

const unauth = await fetch(MCP, { method: 'POST', body: '{}' });
check(unauth.status === 401, `MCP sem credencial → 401 (veio ${unauth.status})`);
check(
  (unauth.headers.get('WWW-Authenticate') ?? '').includes('resource_metadata'),
  '401 traz WWW-Authenticate resource_metadata',
);

const init = await rpc(1, 'initialize', {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'e2e-mcp-oauth', version: '1.0' },
});
check(init.status === 200, `OAuth initialize → 200 (veio ${init.status})`);
check(!!sessionId, 'sessão MCP com mpo_');

const sched = await rpc(2, 'tools/call', {
  name: 'schedule_post',
  arguments: {
    text: 'e2e oauth mcp',
    channelIds: [channel!.id],
    publishAt: new Date(Date.now() + 3600_000).toISOString(),
  },
});
const schedMsg = sched.msg as {
  result?: { isError?: boolean; content?: Array<{ text?: string }> };
};
const schedText = schedMsg?.result?.content?.find((c) => c.text)?.text;
let schedData: { id?: string } | undefined;
try {
  schedData = schedText ? JSON.parse(schedText) : undefined;
} catch {
  schedData = undefined;
}
check(!schedMsg?.result?.isError && !!schedData?.id, 'schedule_post via OAuth ok');

if (failures > 0) {
  console.error(`\ne2e-mcp-oauth: ${failures} falha(s)`);
  process.exit(1);
}
console.log('\ne2e-mcp-oauth: ok');
