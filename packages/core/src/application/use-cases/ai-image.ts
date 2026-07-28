import { ErrorCodes } from '@manypost/contracts';
import { DomainError } from '../../domain/shared/result';
import { sniffMedia } from '../../infra/media/sniff';
import type {
  AiProvider,
  BudgetGuard,
  ImageAspect,
  ImageQualityMode,
} from '../ports/ai-provider';
import { isImageAspect } from '../ports/ai-provider';
import type { AuditLogRepository } from '../ports/approvals';
import type { ChannelProviderRegistry } from '../ports/channel-provider-registry';
import type { MediaRecord, MediaRepository, MediaStorage } from '../ports/media';
import type { PlanPolicy } from '../ports/plan-policy';
import type { ChannelRepository } from '../ports/publishing';
import { withBudget } from './ai-budget';
import type { AiActor } from './ai';
import { persistMediaBytes } from './media';

/**
 * `ai_image` — "IA: gera imagem para o post" (plano Premium, 2 ou 5 créditos).
 *
 * A ordem é a mesma de toda a fatia (design D10): plano → franquia → modelo → confirma/devolve →
 * auditoria. Gatear antes de reservar garante que organização sem a feature nunca gaste franquia
 * descobrindo isso.
 *
 * Três coisas que este arquivo faz e valem registro:
 *
 * 1. **Não confia no `mime` que o provedor declarou.** Os bytes passam pelo mesmo `sniffMedia` de
 *    todo upload, então o que entra na biblioteca é o que os bytes REALMENTE são. Um provedor
 *    (ou um proxy no caminho) devolvendo HTML de erro com `content-type` de imagem não vira uma
 *    mídia quebrada esperando para falhar na publicação.
 * 2. **Marca a proveniência.** `source: 'ai'` mais o prompt e o modelo. Várias plataformas já
 *    exigem divulgação de conteúdo sintético; sem isso gravado junto da mídia, o produto não tem
 *    como cumprir depois.
 * 3. **Uma requisição, uma imagem.** O custo de uma chamada fica previsível e a franquia é
 *    debitada por unidade.
 */

/** ambos ficam acima de texto; qualidade final preserva a classe histórica de 5 créditos */
export const IMAGE_MODE_CREDITS: Record<ImageQualityMode, number> = {
  economy: 2,
  quality: 5,
};

export interface AiImageDeps {
  provider: AiProvider;
  budget: BudgetGuard;
  plan: PlanPolicy;
  media: MediaRepository;
  storage: MediaStorage;
  channels: ChannelRepository;
  registry: ChannelProviderRegistry;
  audit: AuditLogRepository;
  /** teto de bytes da instalação — o mesmo que vale para upload */
  imageMaxBytes: number;
  /** nome do modelo, só para a proveniência: o caso de uso não escolhe modelo */
  modelLabel: string;
}

/**
 * Proporção default por rede. Não é adivinhação: é a forma que cada rede trata melhor no feed.
 * Rede desconhecida cai em 1:1, que é a que nenhuma rede rejeita.
 */
const PROPORCAO_POR_REDE: Record<string, ImageAspect> = {
  instagram: '4:5',
  'instagram-standalone': '4:5',
  facebook: '1.91:1',
  linkedin: '1.91:1',
  x: '16:9',
  threads: '4:5',
  tiktok: '9:16',
  youtube: '16:9',
  mastodon: '16:9',
  bluesky: '16:9',
  devto: '1.91:1',
};

export const proporcaoPara = (providerId: string): ImageAspect =>
  PROPORCAO_POR_REDE[providerId] ?? '1:1';

const mb = (n: number) => Math.round(n / 1024 / 1024);

export const makeGenerateImage =
  (deps: AiImageDeps) =>
  async (
    actor: AiActor,
    input: {
      prompt: string;
      /** proporção explícita; sem ela, `channelId` decide; sem os dois, 1:1 */
      aspect?: string;
      channelId?: string;
      mode?: ImageQualityMode;
      /** descrição para leitor de tela, quando quem chamou já tem uma */
      alt?: string;
    },
  ): Promise<{ media: MediaRecord }> => {
    await deps.plan.assert(actor.orgId, { kind: 'feature', feature: 'ai_image' });

    const prompt = input.prompt.trim();
    if (prompt.length === 0) {
      throw new DomainError(ErrorCodes.PostEmptyContent, 'descreva a imagem que você quer');
    }

    // gerar imagem é capacidade OPCIONAL do adapter: recusar é melhor que devolver um texto
    if (!deps.provider.generateImage) {
      throw new DomainError(
        ErrorCodes.AiCapabilityUnavailable,
        'O provedor configurado nesta instalação não gera imagens.',
      );
    }
    const generateImage = deps.provider.generateImage;

    const aspect = await resolverProporcao(deps, actor.orgId, input);
    const mode = input.mode ?? 'economy';
    const credits = IMAGE_MODE_CREDITS[mode];

    const media = await withBudget(
      deps.budget,
      { orgId: actor.orgId, operation: 'ai.image', credits },
      async () => {
        const imagem = await generateImage({
          prompt,
          aspect,
          mode,
        });

        // o `mime` declarado NÃO é confiável: quem decide é o conteúdo
        const sniffed = sniffMedia(imagem.bytes);
        if (!sniffed || sniffed.kind !== 'image') {
          throw new DomainError(
            ErrorCodes.AiInvalidResponse,
            'O provedor devolveu algo que não é uma imagem utilizável.',
            { retryable: true },
          );
        }
        if (imagem.bytes.byteLength > deps.imageMaxBytes) {
          throw new DomainError(
            ErrorCodes.MediaTooLarge,
            `a imagem gerada tem ${mb(imagem.bytes.byteLength)}MB e o limite é ${mb(deps.imageMaxBytes)}MB`,
          );
        }

        const registro = await persistMediaBytes(deps, {
          orgId: actor.orgId,
          bytes: imagem.bytes,
          mime: sniffed.mime,
          width: sniffed.width ?? imagem.width,
          height: sniffed.height ?? imagem.height,
          alt: input.alt?.trim() || null,
          source: 'ai',
          // o prompt REVISADO, quando o provedor reescreve, é o que de fato produziu a imagem
          generationPrompt: imagem.revisedPrompt ?? prompt,
          generationModel: deps.modelLabel,
        });

        return { result: registro, ...(imagem.usage ? { usage: imagem.usage } : {}) };
      },
    );

    // auditoria registra QUE gerou, nunca o prompt nem os bytes (SPEC ai-content-generation)
    void deps.audit
      .append({
        orgId: actor.orgId,
        actorType: actor.actorType ?? 'USER',
        actorId: actor.userId,
        action: 'ai.image',
        targetType: 'media',
        targetId: media.id,
        detail: { aspect, mode, credits },
      })
      .catch(() => {});

    return { media };
  };

/** proporção explícita > proporção da rede do canal > 1:1 */
async function resolverProporcao(
  deps: AiImageDeps,
  orgId: string,
  input: { aspect?: string; channelId?: string },
): Promise<ImageAspect> {
  if (input.aspect !== undefined) {
    if (!isImageAspect(input.aspect)) {
      throw new DomainError(ErrorCodes.PostInvalidSettings, `proporção não suportada: ${input.aspect}`);
    }
    return input.aspect;
  }
  if (input.channelId) {
    const [canal] = await deps.channels.findMany(orgId, [input.channelId]);
    if (!canal) throw new DomainError(ErrorCodes.NotFound, 'canal não encontrado');
    return proporcaoPara(canal.provider);
  }
  return '1:1';
}
