import { describe, expect, test } from 'bun:test';
import { jsonResponse, mockCtx, runProviderContract } from '../../test-kit/contract';
import {
  buildVideoMetadata,
  enforceShortsIntent,
  tagsLength,
  youtubeProvider as p,
} from './youtube.provider';

runProviderContract(p);

const SECRETS = { clientId: 'cid', clientSecret: 'csec' };
const REDIRECT = 'https://app.test/v1/channels/callback/youtube';

const tokenBody = (over: Record<string, unknown> = {}) => ({
  access_token: 'at',
  refresh_token: 'rt',
  expires_in: 3600,
  scope:
    'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
  ...over,
});

const channelBody = {
  items: [
    {
      id: 'UC_canal',
      snippet: {
        title: 'Canal de Teste',
        customUrl: '@canaldeteste',
        thumbnails: { medium: { url: 'https://yt.test/avatar.jpg' } },
      },
    },
  ],
};

const settings = (over: Record<string, unknown> = {}) => ({ title: 'Meu vídeo', ...over });
const videoItem = { content: 'descrição do vídeo', media: [{ type: 'video' as const, url: 'https://cdn.test/v.mp4', mime: 'video/mp4' }] };

describe('youtube: autorização', () => {
  test('a URL de autorização força refresh token e pede só os dois escopos sensíveis', async () => {
    const ctx = mockCtx(() => jsonResponse({}), SECRETS);
    const { url } = await p.getAuthUrl(ctx, { redirectUri: REDIRECT });
    const q = new URL(url).searchParams;

    // sem estes dois o Google só emite refresh token no primeiro consentimento da conta
    expect(q.get('access_type')).toBe('offline');
    expect(q.get('prompt')).toBe('consent');

    const scopes = q.get('scope')!.split(' ');
    expect(scopes).toEqual([
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
    ]);
    // escopo sensível a mais = verificação do Google maior; analytics só quando ligado
    expect(q.get('scope')).not.toContain('yt-analytics');
    expect(q.get('scope')).not.toContain('youtubepartner');
    expect(q.get('scope')).not.toContain('force-ssl');
  });

  test('com métricas ligadas na instalação, o escopo de analytics entra', async () => {
    const ctx = mockCtx(() => jsonResponse({}), { ...SECRETS, enableAnalytics: 'true' });
    const { url } = await p.getAuthUrl(ctx, { redirectUri: REDIRECT });
    expect(new URL(url).searchParams.get('scope')).toContain('yt-analytics.readonly');
  });
});

describe('youtube: conexão', () => {
  const connectCtx = (token: Record<string, unknown>, channels: unknown = channelBody) =>
    mockCtx((url) => {
      if (url.includes('oauth2.googleapis.com/token')) return jsonResponse(token);
      if (url.includes('/channels')) return jsonResponse(channels);
      return jsonResponse({}, 404);
    }, SECRETS);

  test('o id do CANAL vira o identificador externo da conexão', async () => {
    const ctx = connectCtx(tokenBody());
    const res = await p.exchangeCode(ctx, { code: 'c', redirectUri: REDIRECT });

    // não é o id da conta Google: conectar outro canal da mesma conta tem que virar outro canal
    expect(res.externalId).toBe('UC_canal');
    expect(res.name).toBe('Canal de Teste');
    expect(res.username).toBe('@canaldeteste');
    expect(res.avatarUrl).toBe('https://yt.test/avatar.jpg');
    expect(res.refreshToken).toBe('rt');
  });

  test('conexão sem refresh token é recusada antes de criar o canal', async () => {
    const ctx = connectCtx(tokenBody({ refresh_token: undefined }));
    // um canal sem refresh token morre calado na primeira expiração — melhor falhar agora
    await expect(p.exchangeCode(ctx, { code: 'c', redirectUri: REDIRECT })).rejects.toMatchObject({
      body: expect.stringContaining('refresh token'),
    });
  });

  test('sem o escopo de envio, a conexão é recusada nomeando a permissão', async () => {
    const ctx = connectCtx(
      tokenBody({ scope: 'https://www.googleapis.com/auth/youtube.readonly' }),
    );
    await expect(p.exchangeCode(ctx, { code: 'c', redirectUri: REDIRECT })).rejects.toMatchObject({
      status: 403,
      body: expect.stringContaining('youtube.upload'),
    });
  });

  test('conta sem canal no YouTube é recusada com mensagem legível', async () => {
    const ctx = connectCtx(tokenBody(), { items: [] });
    await expect(p.exchangeCode(ctx, { code: 'c', redirectUri: REDIRECT })).rejects.toMatchObject({
      body: expect.stringContaining('não tem canal'),
    });
  });

  test('a renovação preserva o refresh token guardado quando o Google não reemite', async () => {
    const ctx = mockCtx(() => jsonResponse(tokenBody({ refresh_token: undefined })), SECRETS);
    const set = await p.refreshToken(ctx, 'rt-guardado');
    expect(set.refreshToken).toBe('rt-guardado');
    expect(set.accessToken).toBe('at');
  });
});

describe('youtube: intenção de Short medida no arquivo', () => {
  const vertical = { width: 1080, height: 1920, durationSec: 30 };
  const horizontal = { width: 1920, height: 1080, durationSec: 30 };
  const verticalLongo = { width: 1080, height: 1920, durationSec: 400 };

  test('"short" com vídeo horizontal é recusado dizendo a medida', () => {
    const v = enforceShortsIntent('short', horizontal);
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toContain('1920x1080');
  });

  test('"short" com vídeo vertical longo demais é recusado dizendo a duração', () => {
    const v = enforceShortsIntent('short', verticalLongo);
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toContain('400s');
  });

  test('"video" com arquivo que viraria Short é recusado', () => {
    // sem isso a pessoa agenda um vídeo comum e o YouTube publica um Short sem avisar
    const v = enforceShortsIntent('video', vertical);
    expect(v.ok).toBe(false);
  });

  test('"short" com arquivo vertical e curto passa e sabe que vai virar Short', () => {
    const v = enforceShortsIntent('short', vertical);
    expect(v).toEqual({ ok: true, willBeShort: true });
  });

  test('"auto" aceita qualquer geometria e registra o que vai sair', () => {
    expect(enforceShortsIntent('auto', horizontal)).toEqual({ ok: true, willBeShort: false });
    expect(enforceShortsIntent('auto', vertical)).toEqual({ ok: true, willBeShort: true });
  });

  test('container ilegível: "auto" segue, intenção explícita é recusada', () => {
    // a classificação do YouTube é a autoridade — recusar por não medir seria pior que o risco
    expect(enforceShortsIntent('auto', undefined)).toEqual({ ok: true });
    expect(enforceShortsIntent('short', undefined).ok).toBe(false);
    expect(enforceShortsIntent('video', undefined).ok).toBe(false);
  });
});

describe('youtube: settings e metadados', () => {
  test('título é obrigatório e recusado no agendamento', () => {
    expect(p.settingsSchema.safeParse({}).success).toBe(false);
    expect(p.settingsSchema.safeParse({ title: 'ok' }).success).toBe(true);
    expect(p.settingsSchema.safeParse({ title: 'x'.repeat(101) }).success).toBe(false);
  });

  test('a soma das tags cobra 2 caracteres a mais por tag com espaço', () => {
    expect(tagsLength(['abc'])).toBe(3);
    expect(tagsLength(['a b'])).toBe(5); // 3 + 2 pelas aspas que o YouTube adiciona
    expect(p.settingsSchema.safeParse(settings({ tags: ['x'.repeat(501)] })).success).toBe(false);
    expect(p.settingsSchema.safeParse(settings({ tags: ['jogos', 'ao vivo'] })).success).toBe(true);
  });

  test('corpo do insert: texto do post vira descrição, título vem das settings', () => {
    const cfg = p.settingsSchema.parse(settings({ tags: ['a'] }));
    const body = buildVideoMetadata(cfg, videoItem, new Date('2026-01-01T12:00:00Z')) as any;

    expect(body.snippet.title).toBe('Meu vídeo');
    expect(body.snippet.description).toBe('descrição do vídeo');
    expect(body.snippet.categoryId).toBe('22');
    expect(body.snippet.tags).toEqual(['a']);
    expect(body.status.privacyStatus).toBe('public');
    // declaração legal (COPPA): vai em toda publicação, nunca ausente
    expect(body.status.selfDeclaredMadeForKids).toBe(false);
    expect(body.status.publishAt).toBeUndefined();
  });

  test('publishAt futuro força privado; publishAt vencido é ignorado', () => {
    const now = new Date('2026-01-01T12:00:00Z');
    const futuro = p.settingsSchema.parse(
      settings({ privacyStatus: 'public', publishAt: '2026-01-02T12:00:00.000Z' }),
    );
    const b1 = buildVideoMetadata(futuro, videoItem, now) as any;
    expect(b1.status.privacyStatus).toBe('private'); // o YouTube recusa publishAt com público
    expect(b1.status.publishAt).toBe('2026-01-02T12:00:00.000Z');

    const vencido = p.settingsSchema.parse(
      settings({ privacyStatus: 'public', publishAt: '2025-01-02T12:00:00.000Z' }),
    );
    const b2 = buildVideoMetadata(vencido, videoItem, now) as any;
    expect(b2.status.privacyStatus).toBe('public');
    expect(b2.status.publishAt).toBeUndefined();
  });
});

describe('youtube: publicação', () => {
  /** mock do caminho feliz: HEAD com tamanho, sessão resumível, PUT com o vídeo criado. */
  function publishCtx(over: { putBody?: unknown; thumbStatus?: number } = {}) {
    return mockCtx((url, init) => {
      const method = init?.method ?? 'GET';
      if (url.includes('cdn.test/v.mp4')) {
        return new Response(new Uint8Array(8), { headers: { 'content-length': '1048576' } });
      }
      if (url.includes('cdn.test/thumb.jpg')) {
        return new Response(new Uint8Array(4), { headers: { 'content-type': 'image/jpeg' } });
      }
      if (url.includes('/thumbnails/set')) return jsonResponse({}, over.thumbStatus ?? 200);
      if (url.includes('uploadType=resumable')) {
        return new Response(null, { status: 200, headers: { location: 'https://upload.test/s/1' } });
      }
      if (url.startsWith('https://upload.test/s/')) {
        return jsonResponse(over.putBody ?? { id: 'VID123', status: { privacyStatus: 'public' } });
      }
      return jsonResponse({}, 404);
    }, SECRETS);
  }

  const token = { accessToken: 'at', scopes: [] as string[] };

  test('abre a sessão resumível declarando tamanho e tipo, e sobe os bytes na URL devolvida', async () => {
    const ctx = publishCtx();
    const [res] = await p.publish(ctx, token, [videoItem], settings());

    const init = ctx.calls.find((c) => c.url.includes('uploadType=resumable'))!;
    const headers = init.init!.headers as Record<string, string>;
    expect(headers['x-upload-content-length']).toBe('1048576');
    expect(headers['x-upload-content-type']).toBe('video/mp4');
    expect(JSON.parse(init.init!.body as string).snippet.title).toBe('Meu vídeo');

    const put = ctx.calls.find((c) => c.url === 'https://upload.test/s/1')!;
    expect(put.init!.method).toBe('PUT');
    // o corpo é a stream da origem: o arquivo nunca fica inteiro na memória do worker
    expect(put.init!.body).toBeInstanceOf(ReadableStream);

    expect(res).toEqual({ externalId: 'VID123', releaseUrl: 'https://www.youtube.com/watch?v=VID123' });
  });

  test('origem sem Content-Length é recusada antes de abrir a sessão', async () => {
    // sem o tamanho não dá para abrir a sessão resumível, e bufferizar para descobrir anularia
    // o streaming — melhor falhar com mensagem clara do que carregar o vídeo inteiro na memória
    const ctx = mockCtx((url) => {
      if (url.includes('cdn.test/v.mp4')) return new Response(new Uint8Array(8));
      return jsonResponse({}, 404);
    }, SECRETS);

    await expect(p.publish(ctx, token, [videoItem], settings())).rejects.toMatchObject({
      status: 422,
      body: expect.stringContaining('Content-Length'),
    });
    expect(ctx.calls.some((c) => c.url.includes('uploadType=resumable'))).toBe(false);
  });

  test('miniatura recusada não derruba a publicação', async () => {
    // o vídeo já está no canal: lançar aqui faria a máquina de estados subir o vídeo de novo
    const ctx = publishCtx({ thumbStatus: 400 });
    const [res] = await p.publish(
      ctx,
      token,
      [videoItem],
      settings({ thumbnailUrl: 'https://cdn.test/thumb.jpg' }),
    );
    expect(res!.externalId).toBe('VID123');
  });

  test('vídeo devolvido como privado (projeto sem auditoria) é sucesso, não retentativa', async () => {
    const ctx = publishCtx({ putBody: { id: 'VID9', status: { privacyStatus: 'private' } } });
    const [res] = await p.publish(ctx, token, [videoItem], settings({ privacyStatus: 'public' }));
    expect(res!.externalId).toBe('VID9');
  });

  test('intenção de Short é verificada ANTES de qualquer upload', async () => {
    const ctx = publishCtx();
    // o mock devolve 8 bytes que não são container: geometria indisponível + intenção explícita
    await expect(p.publish(ctx, token, [videoItem], settings({ shortsIntent: 'short' }))).rejects.toMatchObject({
      status: 422,
    });
    expect(ctx.calls.some((c) => c.url.includes('uploadType=resumable'))).toBe(false);
  });
});

describe('youtube: regras de mídia e erros', () => {
  test('publicação precisa de exatamente um vídeo e nenhuma imagem', async () => {
    expect((await p.validateMedia([{ content: 'oi', media: [] }])).ok).toBe(false);
    expect((await p.validateMedia([videoItem])).ok).toBe(true);

    const doisVideos = { content: '', media: [videoItem.media[0]!, videoItem.media[0]!] };
    expect((await p.validateMedia([doisVideos])).ok).toBe(false);

    const comImagem = {
      content: '',
      media: [videoItem.media[0]!, { type: 'image' as const, url: 'https://cdn.test/i.jpg', mime: 'image/jpeg' }],
    };
    const v = await p.validateMedia([comImagem]);
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toContain('miniatura');
  });

  test('classifyError separa reconexão, cota, instabilidade e corpo inválido', () => {
    expect(p.classifyError(400, '{"error":{"errors":[{"reason":"invalid_grant"}]}}')).toBe('refresh-token');
    expect(p.classifyError(403, 'youtubeSignupRequired')).toBe('refresh-token');

    // cota do dia: retentar hoje não muda nada
    expect(p.classifyError(403, '{"errors":[{"reason":"quotaExceeded"}]}')).toBe('permanent');
    expect(p.classifyError(400, 'uploadLimitExceeded')).toBe('permanent');

    // limite de taxa curto continua retentável, mesmo vindo como 403
    expect(p.classifyError(403, '{"errors":[{"reason":"rateLimitExceeded"}]}')).toBe('transient');
    expect(p.classifyError(503, 'backendError')).toBe('transient');

    expect(p.classifyError(400, 'invalidTitle')).toBe('permanent');
    expect(p.classifyError(400, 'invalidCategoryId')).toBe('permanent');
  });
});
