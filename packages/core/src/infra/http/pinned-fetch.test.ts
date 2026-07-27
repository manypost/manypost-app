import { afterAll, describe, expect, test } from 'bun:test';
import http from 'node:http';
import { OutboundBlockedError, makePinnedFetch } from './pinned-fetch';

/**
 * O teste central aqui é o de **rebinding**: um destino cujo DNS responde público na validação
 * e privado na conexão. É o furo que a validação separada do fetch deixava aberto, e a única
 * prova possível é observar em QUAL endereço a conexão realmente saiu.
 */

// servidor "interno": quem chegar aqui atravessou a política
const internal = http.createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('segredo interno');
});
// servidor "público": o destino legítimo
const publicSrv = http.createServer((req, res) => {
  if (req.url === '/redirect') {
    res.writeHead(302, { location: 'http://127.0.0.1:1/interno' });
    res.end();
    return;
  }
  if (req.url === '/slow') {
    setTimeout(() => {
      res.writeHead(200);
      res.end('tarde demais');
    }, 3_000);
    return;
  }
  res.writeHead(200, { 'content-type': 'text/plain', 'x-eco': req.headers.host ?? '' });
  res.end('conteúdo público');
});

const listen = (server: http.Server) =>
  new Promise<number>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve((server.address() as { port: number }).port));
  });
const internalPort = await listen(internal);
const publicPort = await listen(publicSrv);

afterAll(() => {
  internal.close();
  publicSrv.close();
});

/** `allowPrivate` liga o modo dev; é assim que o E2E fala com servidores locais. */
const devFetch = makePinnedFetch({ allowPrivate: true, timeoutMs: 2_000 });

describe('política de saída: destinos recusados', () => {
  const strict = makePinnedFetch({ timeoutMs: 2_000 });

  test('endereço privado literal é recusado com o motivo classificado', async () => {
    const err = await strict(`http://127.0.0.1:${internalPort}/`).catch((e) => e);
    expect(err).toBeInstanceOf(OutboundBlockedError);
    expect((err as OutboundBlockedError).reason).toBe('loopback');
  });

  test('metadata de nuvem é recusado por link-local', async () => {
    const err = await strict('http://169.254.169.254/latest/meta-data/').catch((e) => e);
    expect((err as OutboundBlockedError).reason).toBe('link-local');
  });

  test('IPv4 mapeado em IPv6 não escapa da política', async () => {
    const err = await strict('http://[::ffff:127.0.0.1]/').catch((e) => e);
    expect((err as OutboundBlockedError).reason).toBe('loopback');
  });

  test('formas numéricas ambíguas não driblam a política', async () => {
    // o parser de URL canonicaliza cada uma para 127.0.0.1 e o classificador recusa
    for (const host of ['2130706433', '0x7f000001', '127.1', '0177.0.0.1']) {
      const err = await strict(`http://${host}/`).catch((e) => e);
      expect(err).toBeInstanceOf(OutboundBlockedError);
      expect((err as OutboundBlockedError).reason).toBe('loopback');
    }
    // e a forma que nem o parser aceita vira bloqueio, não TypeError solto
    const bad = await strict('http://999.999.999.999/').catch((e) => e);
    expect(bad).toBeInstanceOf(OutboundBlockedError);
    expect((bad as OutboundBlockedError).reason).toBe('ambiguous-host');
  });

  test('esquema fora de http(s) e credenciais na URL são recusados', async () => {
    await expect(strict('file:///etc/passwd')).rejects.toMatchObject({ reason: 'scheme' });
    await expect(strict('http://user:senha@example.com/')).rejects.toMatchObject({
      reason: 'credentials',
    });
  });

  test('nome que não resolve falha fechado', async () => {
    const err = await strict('http://nao-existe-mesmo.invalid/').catch((e) => e);
    expect((err as OutboundBlockedError).reason).toBe('dns-failure');
  });

  test('a mensagem de erro carrega hostname e motivo, nunca caminho nem query', async () => {
    const err = (await strict('http://127.0.0.1/admin?token=segredo-abc').catch((e) => e)) as Error;
    expect(err.message).toContain('127.0.0.1');
    expect(err.message).toContain('loopback');
    expect(err.message).not.toContain('segredo-abc');
    expect(err.message).not.toContain('/admin');
  });

  test('telemetria recebe só hostname e motivo', async () => {
    const seen: Array<{ hostname: string; reason: string }> = [];
    const f = makePinnedFetch({ onBlocked: (i) => seen.push(i) });
    await f('https://10.0.0.5/webhook?sig=abc').catch(() => {});
    expect(seen).toEqual([{ hostname: '10.0.0.5', reason: 'private' }]);
  });
});

describe('pinagem da conexão', () => {
  /**
   * A prova é indireta e é a única possível: `pin-test.invalid` NÃO existe em DNS nenhum. Se a
   * requisição chega ao servidor, a conexão só pode ter saído pelo endereço que a política
   * aprovou — nenhuma resolução do sistema teria como levá-la lá.
   */
  test('a conexão sai pelo endereço aprovado, não pelo que o sistema resolveria', async () => {
    const pinned = makePinnedFetch({
      timeoutMs: 2_000,
      resolver: async () => [{ address: '127.0.0.1', family: 4 }],
      allowPrivate: true,
    });
    const res = await pinned(`http://pin-test.invalid:${publicPort}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('conteúdo público');
  });

  /**
   * DNS rebinding: um domínio que responde público na validação e privado na conexão. Como a
   * resolução acontece UMA vez e o resultado é fixado no socket, a segunda resposta nunca é
   * consultada — o contador prova que não há segunda consulta.
   */
  test('rebinding: o resolvedor é consultado uma única vez por requisição', async () => {
    let calls = 0;
    const rebinding = makePinnedFetch({
      timeoutMs: 2_000,
      allowPrivate: true,
      resolver: async () => {
        calls++;
        return calls === 1
          ? [{ address: '127.0.0.1', family: 4 }] // resposta da validação
          : [{ address: '10.0.0.7', family: 4 }]; // a que o atacante queria na conexão
      },
    });
    const res = await rebinding(`http://pin-test.invalid:${publicPort}/`);
    expect(res.status).toBe(200);
    expect(calls).toBe(1);
  });

  test('endereço privado devolvido pelo resolvedor é recusado (política vale para DNS também)', async () => {
    const strictWithBadDns = makePinnedFetch({
      timeoutMs: 2_000,
      resolver: async () => [{ address: '10.0.0.7', family: 4 }],
    });
    const err = await strictWithBadDns('http://parece-publico.example/').catch((e) => e);
    expect((err as OutboundBlockedError).reason).toBe('private');
  });

  test('resposta MISTA (um público, um privado) falha fechado', async () => {
    const mixed = makePinnedFetch({
      timeoutMs: 2_000,
      resolver: async () => [
        { address: '93.184.216.34', family: 4 },
        { address: '127.0.0.1', family: 4 },
      ],
    });
    const err = await mixed('http://misto.example/').catch((e) => e);
    expect((err as OutboundBlockedError).reason).toBe('loopback');
  });

  test('o Host enviado continua sendo o hostname, não o endereço fixado', async () => {
    const pinned = makePinnedFetch({
      timeoutMs: 2_000,
      allowPrivate: true,
      resolver: async () => [{ address: '127.0.0.1', family: 4 }],
    });
    const res = await pinned(`http://pin-test.invalid:${publicPort}/`);
    expect(res.headers.get('x-eco')).toBe(`pin-test.invalid:${publicPort}`);
  });
});

describe('redirect e limites', () => {
  test('nunca segue redirect sozinho — devolve o 3xx para quem chamou revalidar', async () => {
    const res = await devFetch(`http://localhost:${publicPort}/redirect`);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('http://127.0.0.1:1/interno');
  });

  test("redirect: 'error' mantém a semântica do fetch", async () => {
    await expect(
      devFetch(`http://localhost:${publicPort}/redirect`, { redirect: 'error' }),
    ).rejects.toThrow();
  });

  test('resposta lenta é cortada pelo timeout', async () => {
    await expect(devFetch(`http://localhost:${publicPort}/slow`)).rejects.toThrow();
  });

  test('corpo é lido normalmente por quem espera um Response', async () => {
    const res = await devFetch(`http://localhost:${publicPort}/`);
    expect(await res.text()).toBe('conteúdo público');
  });

  test('POST com corpo e cabeçalhos chega inteiro', async () => {
    const seen: Array<{ method: string; body: string; header: string }> = [];
    const echo = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        seen.push({ method: req.method ?? '', body, header: req.headers['x-assinatura'] as string });
        res.writeHead(200);
        res.end('ok');
      });
    });
    const port = await listen(echo);
    const res = await devFetch(`http://localhost:${port}/hook`, {
      method: 'POST',
      headers: { 'x-assinatura': 't=1,v1=abc', 'content-type': 'application/json' },
      body: JSON.stringify({ evento: 'post.published' }),
    });
    expect(res.status).toBe(200);
    expect(seen[0]).toMatchObject({
      method: 'POST',
      body: '{"evento":"post.published"}',
      header: 't=1,v1=abc',
    });
    echo.close();
  });
});
