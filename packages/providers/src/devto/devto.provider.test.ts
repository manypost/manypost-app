import { describe, expect, test } from 'bun:test';
import { jsonResponse, mockCtx, runProviderContract } from '../../test-kit/contract';
import { devtoProvider as p } from './devto.provider';

runProviderContract(p);

const KEY = 'dev-key-abcdef';
const token = { accessToken: KEY, scopes: [] };
const ME = { id: 4242, name: 'Thalisson', username: 'thal', profile_image: 'https://dev.to/a.png' };
/** título é obrigatório: todo publish do teste parte deste settings mínimo */
const settings = { title: 'Como publicar em várias redes' };

const ARTICLE = {
  id: 777,
  url: 'https://dev.to/thal/como-publicar-em-varias-redes-1a2b',
};

describe('devto: conexão por API key', () => {
  test('key válida → identidade do autor, key vira o token do canal', async () => {
    const ctx = mockCtx((url, init) => {
      expect(url).toBe('https://dev.to/api/users/me');
      expect((init!.headers as Record<string, string>)['api-key']).toBe(KEY);
      return jsonResponse(ME);
    });
    const account = await p.connectWithFields!(ctx, { fields: { apiKey: KEY } });
    expect(account).toMatchObject({
      accessToken: KEY,
      externalId: '4242',
      name: 'Thalisson',
      username: 'thal',
      avatarUrl: 'https://dev.to/a.png',
    });
    expect(account.scopes).toEqual([]);
    // sem refresh: a key não expira (401 → REFRESH_REQUIRED = colar key nova)
    expect((account as { refreshToken?: string }).refreshToken).toBeUndefined();
  });

  test('key recusada (401) → erro {status} p/ virar channel.connect_failed', async () => {
    const ctx = mockCtx(() => jsonResponse({ error: 'unauthorized' }, 401));
    await expect(p.connectWithFields!(ctx, { fields: { apiKey: KEY } })).rejects.toMatchObject({
      status: 401,
    });
  });

  test('key vazia → rejeitada na validação de campos, sem tocar a rede', async () => {
    const ctx = mockCtx(() => jsonResponse(ME));
    await expect(p.connectWithFields!(ctx, { fields: { apiKey: '' } })).rejects.toThrow();
    expect(ctx.calls).toHaveLength(0);
  });

  test('não exige env: disponível em qualquer instalação', () => {
    expect(p.requiredSecrets ?? []).toEqual([]);
    expect(p.connectionFieldsSchema).toBeDefined();
  });
});

describe('devto: settings do artigo', () => {
  test('título é obrigatório — settings vazio não passa (falha no agendamento)', () => {
    const parsed = p.settingsSchema.safeParse({});
    expect(parsed.success).toBe(false);
  });

  test('título curto demais é recusado', () => {
    expect(p.settingsSchema.safeParse({ title: 'a' }).success).toBe(false);
  });

  test('título válido basta — demais campos são opcionais', () => {
    expect(p.settingsSchema.safeParse(settings).success).toBe(true);
  });

  test('no máximo 4 tags', () => {
    expect(p.settingsSchema.safeParse({ ...settings, tags: ['a', 'b', 'c', 'd'] }).success).toBe(true);
    expect(p.settingsSchema.safeParse({ ...settings, tags: ['a', 'b', 'c', 'd', 'e'] }).success).toBe(
      false,
    );
  });

  test('canonicalUrl precisa ser URL http(s)', () => {
    expect(
      p.settingsSchema.safeParse({ ...settings, canonicalUrl: 'https://blog.exemplo/post' }).success,
    ).toBe(true);
    expect(p.settingsSchema.safeParse({ ...settings, canonicalUrl: 'nao-e-url' }).success).toBe(false);
  });
});

describe('devto: publicação (golden bodies)', () => {
  test('artigo mínimo: title + body_markdown + published, sem campos opcionais', async () => {
    let body: any;
    const ctx = mockCtx((url, init) => {
      expect(url).toBe('https://dev.to/api/articles');
      expect(init!.method).toBe('POST');
      expect((init!.headers as Record<string, string>)['api-key']).toBe(KEY);
      body = JSON.parse(String(init!.body));
      return jsonResponse(ARTICLE, 201);
    });
    const [res] = await p.publish(ctx, token, [{ content: '# Olá\n\ncorpo', media: [] }], settings);

    expect(body).toEqual({
      article: {
        title: 'Como publicar em várias redes',
        body_markdown: '# Olá\n\ncorpo',
        published: true,
      },
    });
    expect(res).toEqual({ externalId: '777', releaseUrl: ARTICLE.url });
  });

  test('uma requisição só — nada é chamado depois do artigo criado', async () => {
    const ctx = mockCtx(() => jsonResponse(ARTICLE, 201));
    await p.publish(ctx, token, [{ content: 'corpo', media: [] }], settings);
    expect(ctx.calls).toHaveLength(1);
  });

  test('campos opcionais entram só quando preenchidos', async () => {
    let body: any;
    const ctx = mockCtx((_url, init) => {
      body = JSON.parse(String(init!.body));
      return jsonResponse(ARTICLE, 201);
    });
    await p.publish(ctx, token, [{ content: 'corpo', media: [] }], {
      ...settings,
      tags: ['bun', 'opensource'],
      canonicalUrl: 'https://blog.exemplo/post',
      organizationId: '55',
    });

    expect(body.article).toMatchObject({
      tags: ['bun', 'opensource'],
      canonical_url: 'https://blog.exemplo/post',
      organization_id: 55,
    });
  });

  test('primeira imagem anexada vira a capa (main_image)', async () => {
    let body: any;
    const ctx = mockCtx((_url, init) => {
      body = JSON.parse(String(init!.body));
      return jsonResponse(ARTICLE, 201);
    });
    await p.publish(
      ctx,
      token,
      [
        {
          content: 'corpo',
          media: [{ type: 'image', url: 'https://cdn.test/capa.png', mime: 'image/png' }],
        },
      ],
      settings,
    );
    expect(body.article.main_image).toBe('https://cdn.test/capa.png');
  });

  test('sem mídia → sem main_image no corpo', async () => {
    let body: any;
    const ctx = mockCtx((_url, init) => {
      body = JSON.parse(String(init!.body));
      return jsonResponse(ARTICLE, 201);
    });
    await p.publish(ctx, token, [{ content: 'corpo', media: [] }], settings);
    expect(body.article).not.toHaveProperty('main_image');
  });

  test('publicar sem título é impossível: settings inválido lança antes da rede', async () => {
    const ctx = mockCtx(() => jsonResponse(ARTICLE, 201));
    await expect(p.publish(ctx, token, [{ content: 'corpo', media: [] }], {})).rejects.toThrow();
    expect(ctx.calls).toHaveLength(0);
  });

  test('erro da plataforma vira {status, body} legível', async () => {
    const ctx = mockCtx(() => jsonResponse({ error: 'title is too long' }, 422));
    await expect(
      p.publish(ctx, token, [{ content: 'corpo', media: [] }], settings),
    ).rejects.toMatchObject({ status: 422 });
  });
});

describe('devto: mídia', () => {
  const img = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      type: 'image' as const,
      url: `https://cdn.test/${i}.png`,
      mime: 'image/png',
    }));

  test('uma imagem (capa) é aceita', async () => {
    expect(await p.validateMedia([{ content: 'x', media: img(1) }])).toEqual({ ok: true });
  });

  test('duas imagens são recusadas — só existe uma capa', async () => {
    const v = await p.validateMedia([{ content: 'x', media: img(2) }]);
    expect(v.ok).toBe(false);
  });

  test('vídeo é recusado', async () => {
    const v = await p.validateMedia([
      { content: 'x', media: [{ type: 'video', url: 'https://cdn.test/v.mp4', mime: 'video/mp4' }] },
    ]);
    expect(v.ok).toBe(false);
  });

  test('artigo só-texto é aceito (requiresMedia falso)', async () => {
    expect(await p.validateMedia([{ content: 'x', media: [] }])).toEqual({ ok: true });
    expect(p.capabilities.requiresMedia ?? false).toBe(false);
  });
});

describe('devto: organizações (sub-contas)', () => {
  const articlesUrl = 'https://dev.to/api/articles/me/all?per_page=1000';

  test('organizações distintas dos artigos do autor viram sub-contas', async () => {
    const ctx = mockCtx((url) => {
      if (url === articlesUrl) {
        return jsonResponse([
          { id: 1, organization: { username: 'acme' } },
          { id: 2, organization: { username: 'acme' } },
          { id: 3 },
          { id: 4, organization: { username: 'globex' } },
        ]);
      }
      if (url === 'https://dev.to/api/organizations/acme') {
        return jsonResponse({ id: 10, name: 'Acme Inc', username: 'acme' });
      }
      if (url === 'https://dev.to/api/organizations/globex') {
        return jsonResponse({ id: 20, name: 'Globex', username: 'globex' });
      }
      return jsonResponse({}, 404);
    });

    const subs = await p.listSubAccounts!(ctx, { ...token, externalId: '4242' });
    expect(subs).toEqual([
      { externalId: '10', name: 'Acme Inc', username: 'acme' },
      { externalId: '20', name: 'Globex', username: 'globex' },
    ]);
  });

  test('autor sem artigo em organização → lista vazia (limitação conhecida da API)', async () => {
    const ctx = mockCtx(() => jsonResponse([{ id: 1 }, { id: 2 }]));
    expect(await p.listSubAccounts!(ctx, { ...token, externalId: '4242' })).toEqual([]);
  });

  test('falha ao listar artigos não derruba o composer — devolve vazio', async () => {
    const ctx = mockCtx(() => jsonResponse({ error: 'boom' }, 500));
    expect(await p.listSubAccounts!(ctx, { ...token, externalId: '4242' })).toEqual([]);
  });
});

describe('devto: erros e renovação', () => {
  test('key inválida (401) → refresh-token, e refreshToken lança ⇒ REFRESH_REQUIRED', async () => {
    expect(p.classifyError(401, '')).toBe('refresh-token');
    const ctx = mockCtx(() => jsonResponse({}));
    await expect(p.refreshToken(ctx, KEY)).rejects.toThrow();
  });

  test('403 também exige key nova', () => {
    expect(p.classifyError(403, '')).toBe('refresh-token');
  });

  test('429 e 5xx são transitórios', () => {
    expect(p.classifyError(429, '')).toBe('transient');
    expect(p.classifyError(503, '')).toBe('transient');
  });

  test('canonical URL duplicada é permanente e diz o motivo', () => {
    expect(p.classifyError(422, 'Canonical url has already been taken')).toBe('permanent');
  });

  test('não conecta por OAuth', async () => {
    const ctx = mockCtx(() => jsonResponse({}));
    await expect(p.getAuthUrl(ctx, { redirectUri: 'https://x/cb' })).rejects.toMatchObject({
      status: 422,
    });
    await expect(
      p.exchangeCode(ctx, { code: 'c', redirectUri: 'https://x/cb' }),
    ).rejects.toMatchObject({ status: 422 });
  });

  test('artigo não tem thread', () => {
    expect(p.capabilities.threads).toBe(false);
    expect(p.publishReply).toBeUndefined();
  });
});
