import { describe, expect, it } from 'bun:test';
import { DomainError } from '../../domain/shared/result';
import type { AiProvider, BudgetGuard, GeneratedImage } from '../ports/ai-provider';
import type { MediaRecord } from '../ports/media';
import type { PlanPolicy } from '../ports/plan-policy';
import type { ChannelRecord } from '../ports/publishing';
import { makeGenerateImage, proporcaoPara, type AiImageDeps } from './ai-image';

const ACTOR = { orgId: 'org-1', userId: 'user-1' };

/** PNG de 1x1 real — passa pelos magic bytes do `sniffMedia` */
const PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  ),
  (c) => c.charCodeAt(0),
);

function harness(
  over: {
    imagem?: Partial<GeneratedImage> | 'sem-capacidade';
    plan?: PlanPolicy;
    canal?: ChannelRecord;
    imageMaxBytes?: number;
    mediaCreateError?: Error;
    storageDeleteError?: Error;
  } = {},
) {
  const orcamento = { reservado: 0, confirmado: 0, devolvido: 0 };
  const creditos = { reservados: [] as number[], confirmados: [] as number[] };
  const guardados: Array<{ key: string; bytes: Uint8Array; mime: string }> = [];
  const criados: MediaRecord[] = [];
  const auditados: Array<Record<string, unknown>> = [];
  const pedidos: Array<Record<string, unknown>> = [];
  const removidos: string[] = [];

  const budget: BudgetGuard = {
    async reserve(_orgId, _operation, credits) {
      orcamento.reservado++;
      creditos.reservados.push(credits);
      return { grantId: 'g1' };
    },
    async commit(_grantId, actual) {
      orcamento.confirmado++;
      creditos.confirmados.push(actual.credits);
    },
    async release() {
      orcamento.devolvido++;
    },
    async balance() {
      throw new Error('não usado');
    },
  };

  const provider: AiProvider = {
    async generateText() {
      throw new Error('não usado');
    },
    ...(over.imagem === 'sem-capacidade'
      ? {}
      : {
          async generateImage(req: Record<string, unknown>) {
            pedidos.push(req);
            const extra = over.imagem === 'sem-capacidade' ? {} : (over.imagem ?? {});
            return {
              bytes: PNG,
              mime: 'image/png',
              width: 1024,
              height: 1024,
              ...extra,
            } as GeneratedImage;
          },
        }),
  };

  const deps: AiImageDeps = {
    provider,
    budget,
    plan:
      over.plan ??
      ({
        async assert() {},
        async check() {
          return { allowed: true };
        },
        async snapshot() {
          throw new Error('não usado');
        },
      } as unknown as PlanPolicy),
    media: {
      async create(d: Record<string, unknown>) {
        if (over.mediaCreateError) throw over.mediaCreateError;
        const rec = {
          id: 'm-1',
          durationSec: null,
          thumbnailPath: null,
          blurhash: null,
          createdAt: new Date(),
          ...d,
        } as MediaRecord;
        criados.push(rec);
        return rec;
      },
    } as unknown as AiImageDeps['media'],
    storage: {
      async put(key: string, bytes: Uint8Array, mime: string) {
        guardados.push({ key, bytes, mime });
      },
      async delete(key: string) {
        removidos.push(key);
        if (over.storageDeleteError) throw over.storageDeleteError;
      },
      publicUrl: (k: string) => `https://mp.test/${k}`,
    } as unknown as AiImageDeps['storage'],
    channels: {
      async findMany(_o: string, ids: string[]) {
        return ids.includes('ch-1') ? [over.canal ?? ({ id: 'ch-1', provider: 'tiktok' } as ChannelRecord)] : [];
      },
    } as unknown as AiImageDeps['channels'],
    registry: { get: () => undefined, list: () => [] } as unknown as AiImageDeps['registry'],
    audit: {
      async append(e: Record<string, unknown>) {
        auditados.push(e);
      },
    } as unknown as AiImageDeps['audit'],
    imageMaxBytes: over.imageMaxBytes ?? 10 * 1024 * 1024,
    modelLabel: 'modelo-de-imagem',
  };

  return { deps, orcamento, creditos, guardados, criados, auditados, pedidos, removidos };
}

const planoQueNega = (): PlanPolicy =>
  ({
    async assert() {
      throw new DomainError('plan.feature_locked', 'assine o Premium', { requiredTier: 'PREMIUM' });
    },
    async check() {
      return { allowed: true };
    },
    async snapshot() {
      throw new Error('não usado');
    },
  }) as unknown as PlanPolicy;

describe('gate e capacidade antes de qualquer gasto', () => {
  it('plano sem a feature recusa sem reservar e sem chamar o provedor', async () => {
    const { deps, orcamento, pedidos } = harness({ plan: planoQueNega() });
    const erro = (await makeGenerateImage(deps)(ACTOR, { prompt: 'um gato' }).catch(
      (e: unknown) => e,
    )) as DomainError;

    expect(erro.code).toBe('plan.feature_locked');
    expect(orcamento.reservado).toBe(0);
    expect(pedidos).toHaveLength(0);
  });

  it('provedor que não desenha recusa explicitamente, sem reservar', async () => {
    const { deps, orcamento } = harness({ imagem: 'sem-capacidade' });
    const erro = (await makeGenerateImage(deps)(ACTOR, { prompt: 'um gato' }).catch(
      (e: unknown) => e,
    )) as DomainError;

    expect(erro.code).toBe('ai.capability_unavailable');
    expect(orcamento.reservado).toBe(0);
  });

  it('prompt vazio é recusado antes do provedor', async () => {
    const { deps, pedidos } = harness();
    const erro = (await makeGenerateImage(deps)(ACTOR, { prompt: '   ' }).catch(
      (e: unknown) => e,
    )) as DomainError;

    expect(erro.code).toBe('post.empty_content');
    expect(pedidos).toHaveLength(0);
  });

  it('proporção fora do conjunto é recusada antes do provedor', async () => {
    const { deps, pedidos, orcamento } = harness();
    const erro = (await makeGenerateImage(deps)(ACTOR, {
      prompt: 'x',
      aspect: '3:7',
    }).catch((e: unknown) => e)) as DomainError;

    expect(erro.code).toBe('post.invalid_settings');
    expect(pedidos).toHaveLength(0);
    expect(orcamento.reservado).toBe(0);
  });
});

describe('proporção: a forma vem da rede, nunca do pixel', () => {
  it('cada rede tem a sua forma de feed', () => {
    expect(proporcaoPara('tiktok')).toBe('9:16');
    expect(proporcaoPara('instagram')).toBe('4:5');
    expect(proporcaoPara('youtube')).toBe('16:9');
    expect(proporcaoPara('linkedin')).toBe('1.91:1');
  });

  it('rede desconhecida cai em 1:1, que nenhuma rejeita', () => {
    expect(proporcaoPara('rede-que-nao-existe')).toBe('1:1');
  });

  it('o canal decide a proporção quando ela não é explícita', async () => {
    const { deps, pedidos } = harness();
    await makeGenerateImage(deps)(ACTOR, { prompt: 'x', channelId: 'ch-1' });
    expect(pedidos[0]!.aspect).toBe('9:16'); // o canal do dublê é tiktok
  });

  it('proporção explícita vence o canal', async () => {
    const { deps, pedidos } = harness();
    await makeGenerateImage(deps)(ACTOR, { prompt: 'x', channelId: 'ch-1', aspect: '1:1' });
    expect(pedidos[0]!.aspect).toBe('1:1');
  });

  it('canal de outra organização é 404 e não gasta franquia', async () => {
    const { deps, orcamento } = harness();
    const erro = (await makeGenerateImage(deps)(ACTOR, {
      prompt: 'x',
      channelId: 'ch-de-outra-org',
    }).catch((e: unknown) => e)) as DomainError;

    expect(erro.code).toBe('common.not_found');
    expect(orcamento.reservado).toBe(0);
  });
});

describe('os bytes são validados como bytes', () => {
  it('imagem boa entra na biblioteca com a proveniência declarada', async () => {
    const { deps, criados, guardados, orcamento } = harness({
      imagem: { revisedPrompt: 'um gato, luz quente' },
    });

    const { media } = await makeGenerateImage(deps)(ACTOR, { prompt: 'um gato' });

    expect(media.source).toBe('ai');
    expect(media.generationPrompt).toBe('um gato, luz quente'); // o prompt REVISADO
    expect(media.generationModel).toBe('modelo-de-imagem');
    expect(media.mime).toBe('image/png');
    expect(criados).toHaveLength(1);
    expect(guardados[0]!.key.startsWith('org-1/')).toBe(true);
    expect(orcamento.confirmado).toBe(1);
    expect(orcamento.devolvido).toBe(0);
  });

  it('sem prompt revisado, guarda o que a pessoa escreveu', async () => {
    const { deps } = harness();
    const { media } = await makeGenerateImage(deps)(ACTOR, { prompt: '  um gato  ' });
    expect(media.generationPrompt).toBe('um gato');
  });

  /**
   * O `mime` que o provedor declara não é confiável — um proxy no caminho devolvendo HTML de erro
   * com content-type de imagem produziria mídia quebrada esperando para falhar na publicação.
   */
  it('bytes que NÃO são imagem falham e devolvem a franquia', async () => {
    const { deps, orcamento, criados, guardados } = harness({
      imagem: { bytes: new TextEncoder().encode('<html>erro do proxy</html>'), mime: 'image/png' },
    });

    const erro = (await makeGenerateImage(deps)(ACTOR, { prompt: 'x' }).catch(
      (e: unknown) => e,
    )) as DomainError;

    expect(erro.code).toBe('ai.invalid_response');
    expect(orcamento.devolvido).toBe(1);
    expect(orcamento.confirmado).toBe(0);
    expect(criados).toHaveLength(0);
    expect(guardados).toHaveLength(0);
  });

  it('imagem acima do teto da instalação não é guardada', async () => {
    const { deps, orcamento, criados } = harness({ imageMaxBytes: 10 });
    const erro = (await makeGenerateImage(deps)(ACTOR, { prompt: 'x' }).catch(
      (e: unknown) => e,
    )) as DomainError;

    expect(erro.code).toBe('media.too_large');
    expect(criados).toHaveLength(0);
    expect(orcamento.devolvido).toBe(1);
  });

  it('falha ao criar a linha remove o arquivo, preserva o erro e devolve a franquia', async () => {
    const primary = new Error('banco indisponível');
    const { deps, orcamento, guardados, removidos } = harness({
      mediaCreateError: primary,
      storageDeleteError: new Error('limpeza também falhou'),
    });

    const error = await makeGenerateImage(deps)(ACTOR, { prompt: 'x' }).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBe(primary);
    expect(guardados).toHaveLength(1);
    expect(removidos).toEqual([guardados[0]!.key]);
    expect(orcamento.devolvido).toBe(1);
    expect(orcamento.confirmado).toBe(0);
  });
});

describe('auditoria e custo', () => {
  it('economia é o padrão determinístico e custa 2 créditos', async () => {
    const { deps, creditos, pedidos } = harness();
    await makeGenerateImage(deps)(ACTOR, { prompt: 'x' });

    expect(pedidos[0]!.mode).toBe('economy');
    expect(creditos.reservados).toEqual([2]);
    expect(creditos.confirmados).toEqual([2]);
  });

  it('qualidade final custa 5 créditos', async () => {
    const { deps, creditos, pedidos } = harness();
    await makeGenerateImage(deps)(ACTOR, { prompt: 'x', mode: 'quality' });

    expect(pedidos[0]!.mode).toBe('quality');
    expect(creditos.reservados).toEqual([5]);
    expect(creditos.confirmados).toEqual([5]);
  });

  it('registra que gerou, sem o prompt e sem os bytes', async () => {
    const { deps, auditados } = harness();
    await makeGenerateImage(deps)(ACTOR, {
      prompt: 'segredo do prompt',
      aspect: '1:1',
      mode: 'quality',
    });
    await Promise.resolve();

    expect(auditados[0]).toMatchObject({
      orgId: 'org-1',
      actorId: 'user-1',
      action: 'ai.image',
      detail: { aspect: '1:1', mode: 'quality', credits: 5 },
    });
    expect(JSON.stringify(auditados[0])).not.toContain('segredo do prompt');
    expect(JSON.stringify(auditados[0])).not.toContain('PNG');
  });

  it('uma requisição gera UMA imagem e reserva uma vez', async () => {
    const { deps, orcamento, pedidos, criados } = harness();
    await makeGenerateImage(deps)(ACTOR, { prompt: 'x' });

    expect(pedidos).toHaveLength(1);
    expect(criados).toHaveLength(1);
    expect(orcamento.reservado).toBe(1);
  });
});
