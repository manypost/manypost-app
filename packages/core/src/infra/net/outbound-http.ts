import http from 'node:http';
import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { ErrorCodes } from '@manypost/contracts';
import { DomainError } from '../../domain/shared/result';
import { classifyAddress, isForbiddenClassification, type ClassifiedAddress } from './ip-classify';

export interface OutboundPolicy {
  /** Self-hosted/dev: permite destinos privados (sem pin/classificação). */
  allowPrivate?: boolean;
  /** Máximo de redirects manuais (default 3). */
  maxRedirects?: number;
  /** Timeout total por hop em ms (default 30_000). */
  timeoutMs?: number;
  /** Teto de bytes do corpo; se omitido, não limita (só para HEAD/metadata). */
  maxBytes?: number;
  /** Rótulo em erros de domínio (webhook, mídia, oauth_cimd). */
  what?: string;
  /** User-Agent. */
  userAgent?: string;
  /** Injetável em testes. */
  resolve?: (hostname: string) => Promise<ClassifiedAddress[]>;
  /**
   * Quando true (default), HTTPS→HTTP em redirect é rejeitado.
   * HTTP→HTTPS é permitido.
   */
  rejectHttpsDowngrade?: boolean;
}

export interface OutboundRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string | Uint8Array | null;
  /** Se 'manual' (default), não segue redirect — caller controla. Se 'follow', segue com revalidação. */
  redirect?: 'manual' | 'follow' | 'error';
}

export interface OutboundResponse {
  status: number;
  headers: Headers;
  url: string;
  /** Corpo completo (respeitando maxBytes). */
  body: Uint8Array;
}

const looksLikeIpLiteral = (hostname: string): boolean =>
  /^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname.includes(':');

const defaultResolve = async (hostname: string): Promise<ClassifiedAddress[]> => {
  if (looksLikeIpLiteral(hostname)) {
    return [classifyAddress(hostname)];
  }
  const addrs = await lookup(hostname, { all: true, verbatim: true });
  return addrs.map((a) => classifyAddress(a.address));
};

/** Hostname sem query/credenciais — seguro para logs. */
export function hostnameForLog(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname;
  } catch {
    return '(invalid-url)';
  }
}

/**
 * Resolve e valida todos os endereços. Rejeita se vazio, inválido ou qualquer
 * resposta forbiden (fail closed em mixed public/private).
 * Retorna o primeiro endereço público para pin.
 */
export async function resolvePublicAddresses(
  hostname: string,
  policy: OutboundPolicy = {},
): Promise<{ pinned: ClassifiedAddress; all: ClassifiedAddress[] }> {
  if (policy.allowPrivate) {
    const fake: ClassifiedAddress = { family: 'ipv4', address: '0.0.0.0', classification: 'public' };
    return { pinned: fake, all: [fake] };
  }
  const resolve = policy.resolve ?? defaultResolve;
  const all = await resolve(hostname).catch(() => [] as ClassifiedAddress[]);
  const what = policy.what ?? 'URL';
  if (all.length === 0) {
    throw new DomainError(
      ErrorCodes.PostInvalidSettings,
      `URL de ${what} não permitida (DNS falhou)`,
      { reason: 'dns_failed', hostname },
    );
  }
  if (all.some((a) => isForbiddenClassification(a.classification))) {
    throw new DomainError(
      ErrorCodes.PostInvalidSettings,
      `URL de ${what} não permitida (rede privada)`,
      { reason: 'forbidden_address', hostname },
    );
  }
  const publicOnes = all.filter((a) => a.classification === 'public');
  if (publicOnes.length === 0) {
    throw new DomainError(
      ErrorCodes.PostInvalidSettings,
      `URL de ${what} não permitida (rede privada)`,
      { reason: 'no_public_address', hostname },
    );
  }
  return { pinned: publicOnes[0]!, all: publicOnes };
}

function assertUrlPolicy(rawUrl: string, policy: OutboundPolicy): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new DomainError(ErrorCodes.PostInvalidSettings, `URL de ${policy.what ?? 'destino'} inválida`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new DomainError(
      ErrorCodes.PostInvalidSettings,
      `URL de ${policy.what ?? 'destino'} deve ser http(s)`,
      { reason: 'bad_scheme', hostname: url.hostname },
    );
  }
  if (url.username || url.password) {
    throw new DomainError(
      ErrorCodes.PostInvalidSettings,
      `URL de ${policy.what ?? 'destino'} não pode carregar credenciais`,
      { reason: 'userinfo', hostname: url.hostname },
    );
  }
  // portas: só 80/443 por padrão (ou default implícito)
  const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
  if (!policy.allowPrivate && port !== 80 && port !== 443) {
    throw new DomainError(
      ErrorCodes.PostInvalidSettings,
      `URL de ${policy.what ?? 'destino'} usa porta não permitida`,
      { reason: 'bad_port', hostname: url.hostname },
    );
  }
  return url;
}

/**
 * Valida URL + DNS público (sem conectar). Compatível com o antigo assertPublicUrl.
 */
export async function assertPublicDestination(rawUrl: string, policy: OutboundPolicy = {}): Promise<void> {
  const url = assertUrlPolicy(rawUrl, policy);
  if (policy.allowPrivate) return;
  await resolvePublicAddresses(url.hostname, policy);
}

function connectHost(addr: ClassifiedAddress): string {
  return addr.family === 'ipv6' ? addr.address : addr.address;
}

async function rawRequest(
  url: URL,
  pinned: ClassifiedAddress | null,
  init: {
    method: string;
    headers: Record<string, string>;
    body?: string | Uint8Array | null;
    timeoutMs: number;
    maxBytes?: number;
    allowPrivate: boolean;
  },
): Promise<OutboundResponse> {
  const isHttps = url.protocol === 'https:';
  const lib = isHttps ? https : http;
  const method = init.method.toUpperCase();
  const headers: Record<string, string> = { ...init.headers };

  const options: http.RequestOptions = {
    method,
    path: `${url.pathname}${url.search}`,
    timeout: init.timeoutMs,
    headers,
  };

  if (init.allowPrivate || !pinned) {
    options.hostname = url.hostname;
    options.port = url.port || (isHttps ? 443 : 80);
    if (isHttps) {
      (options as https.RequestOptions).servername = url.hostname;
    }
  } else {
    // Pin: conecta no IP validado; SNI/Host preservam o hostname original (TLS + vhosts).
    options.hostname = connectHost(pinned);
    options.port = url.port || (isHttps ? 443 : 80);
    options.family = pinned.family === 'ipv6' ? 6 : 4;
    headers.host = url.host;
    options.headers = headers;
    if (isHttps) {
      (options as https.RequestOptions).servername = url.hostname;
    }
  }

  return new Promise((resolve, reject) => {
    const req = lib.request(options, (res) => {
      const chunks: Buffer[] = [];
      let total = 0;
      res.on('data', (chunk: Buffer) => {
        total += chunk.byteLength;
        if (init.maxBytes !== undefined && total > init.maxBytes) {
          res.destroy();
          reject(
            new DomainError(ErrorCodes.MediaTooLarge, `resposta excede o limite de ${init.maxBytes} bytes`, {
              reason: 'byte_ceiling',
              hostname: url.hostname,
            }),
          );
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        const hdrs = new Headers();
        for (const [k, v] of Object.entries(res.headers)) {
          if (v === undefined) continue;
          if (Array.isArray(v)) v.forEach((x) => hdrs.append(k, x));
          else hdrs.set(k, v);
        }
        resolve({
          status: res.statusCode ?? 0,
          headers: hdrs,
          url: url.toString(),
          body: new Uint8Array(body),
        });
      });
      res.on('error', reject);
    });
    req.on('timeout', () => {
      req.destroy();
      reject(
        new DomainError(ErrorCodes.MediaFetchFailed, `timeout ao contatar ${url.hostname}`, {
          reason: 'timeout',
          hostname: url.hostname,
        }),
      );
    });
    req.on('error', (err) => {
      reject(
        new DomainError(ErrorCodes.MediaFetchFailed, `conexão falhou: ${String(err).slice(0, 200)}`, {
          reason: 'connect_failed',
          hostname: url.hostname,
        }),
      );
    });
    if (init.body != null) {
      req.write(init.body);
    }
    req.end();
  });
}

/**
 * HTTP de saída com resolução validada, pin de endereço e redirects revalidados.
 */
export async function outboundRequest(
  input: OutboundRequest,
  policy: OutboundPolicy = {},
): Promise<OutboundResponse> {
  const maxRedirects = policy.maxRedirects ?? 3;
  const timeoutMs = policy.timeoutMs ?? 30_000;
  const rejectDowngrade = policy.rejectHttpsDowngrade !== false;
  const redirectMode = input.redirect ?? 'follow';

  let current = input.url;
  let method = (input.method ?? 'GET').toUpperCase();
  let body = input.body ?? null;
  const baseHeaders: Record<string, string> = {
    ...(policy.userAgent ? { 'user-agent': policy.userAgent } : {}),
    ...input.headers,
  };

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const url = assertUrlPolicy(current, policy);
    let pinned: ClassifiedAddress | null = null;
    if (!policy.allowPrivate) {
      pinned = (await resolvePublicAddresses(url.hostname, policy)).pinned;
    }

    const res = await rawRequest(url, pinned, {
      method,
      headers: baseHeaders,
      body,
      timeoutMs,
      ...(policy.maxBytes !== undefined ? { maxBytes: policy.maxBytes } : {}),
      allowPrivate: !!policy.allowPrivate,
    });

    const isRedirect = res.status >= 300 && res.status < 400;
    if (!isRedirect) return res;

    if (redirectMode === 'error') {
      throw new DomainError(ErrorCodes.MediaFetchFailed, `redirect inesperado (${res.status})`, {
        reason: 'redirect_error',
        hostname: url.hostname,
      });
    }
    if (redirectMode === 'manual') return res;

    const location = res.headers.get('location');
    if (!location) return res;
    if (hop === maxRedirects) {
      throw new DomainError(ErrorCodes.MediaFetchFailed, 'muitos redirects', {
        reason: 'redirect_limit',
        hostname: url.hostname,
      });
    }

    const next = new URL(location, url);
    if (rejectDowngrade && url.protocol === 'https:' && next.protocol === 'http:') {
      throw new DomainError(
        ErrorCodes.PostInvalidSettings,
        `URL de ${policy.what ?? 'destino'} não pode fazer downgrade HTTPS→HTTP`,
        { reason: 'https_downgrade', hostname: next.hostname },
      );
    }
    // 303 / 302 em POST → GET sem body (prática comum)
    if (res.status === 303 || ((res.status === 302 || res.status === 301) && method !== 'GET' && method !== 'HEAD')) {
      method = 'GET';
      body = null;
    }
    current = next.toString();
  }

  throw new DomainError(ErrorCodes.MediaFetchFailed, 'muitos redirects', { reason: 'redirect_limit' });
}
