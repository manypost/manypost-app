import { lookup as dnsLookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { classifyAddress, type ForbiddenReason } from '../../domain/shared/ip-address';

/**
 * `fetch` endurecido para requisições de saída (anti-SSRF — SPEC_API_MCP §3).
 *
 * O problema que ele resolve não é "validar a URL" — isso já existia. É o intervalo entre
 * validar e conectar: `assertPublicUrl` resolvia o nome, aprovava, e **um `fetch` separado
 * resolvia de novo**. Entre as duas resoluções o dono do domínio pode trocar a resposta do DNS
 * (rebinding) e a conexão sai para um endereço que nunca foi aprovado.
 *
 * Aqui a resolução acontece UMA vez e o conjunto aprovado é **fixado na conexão**: o `lookup`
 * do socket devolve só aqueles endereços, então é impossível conectar em outro. O hostname
 * continua sendo o hostname — SNI e `Host` saem corretos de graça, e o certificado é validado
 * contra o nome, não contra o IP.
 *
 * **Nunca segue redirect.** Um 3xx seguido automaticamente é um salto sem validação; quem chama
 * decide seguir, e cada salto volta por aqui inteiro. `redirect: 'error'` mantém a semântica do
 * fetch (3xx vira erro); qualquer outro valor devolve a resposta 3xx para o chamador tratar.
 */

/** Motivos próprios da requisição; os motivos de endereço vêm do `ForbiddenReason` do domínio. */
export type RequestBlockReason = 'scheme' | 'credentials' | 'ambiguous-host' | 'dns-failure';
export type BlockReason = RequestBlockReason | ForbiddenReason;

export class OutboundBlockedError extends Error {
  constructor(
    readonly hostname: string,
    readonly reason: string,
  ) {
    // a mensagem carrega hostname e motivo — nunca caminho, query ou header assinado
    super(`destino não permitido (${reason}): ${hostname}`);
    this.name = 'OutboundBlockedError';
  }
}

export interface PinnedFetchOptions {
  /** dev/self-host: aceita destino em rede privada. No gerenciado é falso e explícito. */
  allowPrivate?: boolean;
  timeoutMs?: number;
  /** telemetria de decisão: só hostname e motivo, nunca a URL inteira */
  onBlocked?: (info: { hostname: string; reason: string }) => void;
  /**
   * Costura do resolvedor de nomes. Existe para o teste conseguir provar a pinagem (resolver
   * um nome que não existe em DNS e observar onde a conexão saiu) — em produção fica ausente
   * e vale o `dns.lookup` do sistema.
   */
  resolver?: (hostname: string) => Promise<Array<{ address: string; family: number }>>;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/** Corpo Node → `ReadableStream`, para o chamador ler com o mesmo `getReader()` de sempre. */
function toWebStream(res: http.IncomingMessage): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      res.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
      res.on('end', () => {
        try {
          controller.close();
        } catch {
          /* já fechado por cancel() */
        }
      });
      res.on('error', (err) => controller.error(err));
    },
    cancel() {
      res.destroy();
    },
  });
}

/** Status em que o fetch proíbe corpo — construir `Response` com corpo aqui lança. */
const NULL_BODY = new Set([101, 204, 205, 304]);

export function makePinnedFetch(options: PinnedFetchOptions = {}): typeof fetch {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const block = (hostname: string, reason: BlockReason): never => {
    options.onBlocked?.({ hostname, reason });
    throw new OutboundBlockedError(hostname, reason);
  };

  /** Resolve o destino e devolve SÓ endereços aprovados; qualquer reprovado derruba tudo. */
  async function resolveAllowed(hostname: string): Promise<Array<{ address: string; family: number }>> {
    // hostname entre colchetes = literal IPv6 na URL
    const literal = hostname.startsWith('[') ? hostname.slice(1, -1) : hostname;

    // Formas numéricas ambíguas (`2130706433`, `0x7f000001`, `127.1`) não precisam de guarda:
    // o parser de URL já as canonicalizou para a forma pontilhada antes de chegarem aqui, e as
    // inválidas fizeram o `new URL` lançar (tratado como `ambiguous-host` no chamador).
    const asLiteral = classifyAddress(literal);
    if (asLiteral.allowed) return [{ address: literal, family: asLiteral.family }];
    if (asLiteral.reason !== 'malformed') {
      // é um IP literal, e é um IP proibido
      if (options.allowPrivate) return [{ address: literal, family: literal.includes(':') ? 6 : 4 }];
      block(hostname, asLiteral.reason);
    }

    const resolve = options.resolver ?? ((h: string) => dnsLookup(h, { all: true }));
    const answers = await resolve(literal).catch(() => []);
    if (answers.length === 0) block(hostname, 'dns-failure');
    if (options.allowPrivate) return answers.map((a) => ({ address: a.address, family: a.family }));

    // Resposta mista falha FECHADO: um nome que devolve um endereço público e um privado é
    // exatamente o formato de um ataque de rebinding, não uma configuração legítima.
    for (const a of answers) {
      const verdict = classifyAddress(a.address);
      if (!verdict.allowed) block(hostname, verdict.reason);
    }
    return answers.map((a) => ({ address: a.address, family: a.family }));
  }

  /** host numérico impossível (`999.999.999.999`) e afins: o parser de URL recusa antes de nós.
   *  Vira bloqueio, não `TypeError` solto — quem chama trata um tipo de erro só. */
  const parseUrl = (raw: string): URL => {
    try {
      return new URL(raw);
    } catch {
      return block(raw.slice(0, 60), 'ambiguous-host');
    }
  };

  return async function pinnedFetch(
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = parseUrl(raw);

    if (url.protocol !== 'https:' && url.protocol !== 'http:') block(url.hostname, 'scheme');
    // userinfo na URL (`https://user:senha@host/`) confunde leitura humana e alguns parsers
    if (url.username || url.password) block(url.hostname, 'credentials');

    const allowed = await resolveAllowed(url.hostname);
    const transport = url.protocol === 'https:' ? https : http;

    const headers = new Headers(init?.headers as ConstructorParameters<typeof Headers>[0]);
    const body = init?.body;
    const outgoing: Record<string, string> = {};
    headers.forEach((value, key) => {
      outgoing[key] = value;
    });

    return new Promise<Response>((resolve, reject) => {
      const req = transport.request(
        {
          protocol: url.protocol,
          hostname: url.hostname.replace(/^\[|\]$/g, ''),
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: `${url.pathname}${url.search}`,
          method: init?.method ?? 'GET',
          headers: outgoing,
          timeout: timeoutMs,
          // socket dedicado: um agente com keep-alive poderia reusar conexão aberta antes
          // desta validação, e aí a pinagem deste request não valeria nada
          agent: false,
          /**
           * A pinagem em si. O connector chama isto no lugar do DNS, então a conexão só pode
           * sair para um endereço já aprovado. Bun exige o formato `all: true` (array): com a
           * assinatura antiga de três argumentos ele quebra em `results.sort is not a function`.
           */
          lookup: (
            _hostname: string,
            _opts: unknown,
            cb: (err: NodeJS.ErrnoException | null, addresses: Array<{ address: string; family: number }>) => void,
          ) => cb(null, allowed),
        } as https.RequestOptions,
        (res) => {
          const status = res.statusCode ?? 502;
          if (init?.redirect === 'error' && status >= 300 && status < 400) {
            res.destroy();
            reject(new TypeError('redirect não permitido nesta requisição'));
            return;
          }
          const resHeaders = new Headers();
          for (const [key, value] of Object.entries(res.headers)) {
            if (value === undefined) continue;
            for (const v of Array.isArray(value) ? value : [value]) resHeaders.append(key, v);
          }
          const useBody = !NULL_BODY.has(status) && (init?.method ?? 'GET').toUpperCase() !== 'HEAD';
          resolve(
            new Response(useBody ? toWebStream(res) : null, {
              status,
              statusText: res.statusMessage ?? '',
              headers: resHeaders,
            }),
          );
          if (!useBody) res.resume();
        },
      );

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy(new Error(`tempo esgotado após ${timeoutMs}ms`));
      });

      const signal = init?.signal;
      if (signal) {
        if (signal.aborted) req.destroy(new Error('requisição abortada'));
        else signal.addEventListener('abort', () => req.destroy(new Error('requisição abortada')), { once: true });
      }

      if (body === undefined || body === null) req.end();
      else if (typeof body === 'string') req.end(body);
      else if (body instanceof Uint8Array) req.end(Buffer.from(body));
      else req.end(String(body));
    });
  } as typeof fetch;
}
