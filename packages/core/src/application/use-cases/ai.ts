import { ErrorCodes, type PlanFeature } from '@manypost/contracts';
import { z } from 'zod';
import { DomainError } from '../../domain/shared/result';
import { shortenTo } from '../ai/shorten';
import { parseStructured } from '../ai/structured';
import * as prompts from '../prompts';
import type { AiProvider, TokenUsage } from '../ports/ai-provider';
import type { BudgetGuard } from '../ports/ai-provider';
import type { AuditLogRepository } from '../ports/approvals';
import type { ChannelProviderRegistry } from '../ports/channel-provider-registry';
import type { MediaRepository, MediaStorage } from '../ports/media';
import type { PlanPolicy } from '../ports/plan-policy';
import type { ChannelRecord, ChannelRepository } from '../ports/publishing';
import { withBudget } from './ai-budget';

/**
 * Casos de uso de IA de criação (SPEC_AI §3).
 *
 * A ordem é sempre a mesma e não é acidental (design D10):
 *   plano → franquia → modelo → confirmação/devolução → auditoria.
 *
 * Gatear ANTES de reservar garante que uma org sem a feature nunca gaste franquia descobrindo
 * isso; reservar antes de chamar garante que nenhum caminho chegue ao modelo sem teto.
 */

export interface AiDeps {
  provider: AiProvider;
  budget: BudgetGuard;
  plan: PlanPolicy;
  channels: ChannelRepository;
  registry: ChannelProviderRegistry;
  media: MediaRepository;
  storage: MediaStorage;
  audit: AuditLogRepository;
}

/** custo em créditos por operação — uma geração de texto é um crédito (design/open question 2) */
const CUSTO = { caption: 1, rewrite: 1, hashtags: 1, altText: 1, draft: 2, weekPlan: 3 } as const;

const ausente = (o: string) => new DomainError(ErrorCodes.NotFound, `canal não encontrado: ${o}`);

/** rótulo humano da rede para o prompt — o id técnico não diz nada ao modelo */
const nomeDaRede = (registry: ChannelProviderRegistry, providerId: string): string =>
  registry.get(providerId)?.name ?? providerId;

/**
 * Limite do canal com o MESMO merge que o agendamento usa (canal + settings da publicação,
 * decisão 4/21). Sem isso, uma conta verificada do X receberia legenda cortada em 280 e o
 * usuário perderia espaço que ele pagou para ter.
 */
const limiteDoCanal = (
  registry: ChannelProviderRegistry,
  channel: ChannelRecord,
  settings?: Record<string, unknown>,
): number => {
  const provider = registry.get(channel.provider);
  if (!provider) return 0;
  return provider.capabilities.maxLength({
    ...((channel.settings as Record<string, unknown> | null) ?? {}),
    ...(settings ?? {}),
  });
};

const briefDoCanal = (
  registry: ChannelProviderRegistry,
  channel: ChannelRecord,
  settings?: Record<string, unknown>,
): prompts.ChannelBrief => ({
  channelId: channel.id,
  network: nomeDaRede(registry, channel.provider),
  maxLength: limiteDoCanal(registry, channel, settings),
});

/** carrega os canais pedidos garantindo que TODOS são desta org (id de fora = 404) */
async function carregarCanais(
  channels: ChannelRepository,
  orgId: string,
  ids: string[],
): Promise<ChannelRecord[]> {
  if (ids.length === 0) {
    throw new DomainError(ErrorCodes.PostNoChannels, 'escolha ao menos um canal');
  }
  const encontrados = await channels.findMany(orgId, ids);
  const porId = new Map(encontrados.map((c) => [c.id, c]));
  const faltando = ids.find((id) => !porId.has(id));
  if (faltando) throw ausente(faltando);
  return ids.map((id) => porId.get(id)!);
}

const textoObrigatorio = (texto: string, campo: string): string => {
  const limpo = texto.trim();
  if (limpo.length === 0) {
    throw new DomainError(ErrorCodes.PostEmptyContent, `${campo} não pode ficar vazio`);
  }
  return limpo;
};

/** registro de que a geração aconteceu — sem prompt e sem texto gerado (SPEC ai-content-generation) */
const auditar = (
  deps: AiDeps,
  input: AiActor & { operation: string; detail?: Record<string, unknown> },
) =>
  deps.audit
    .append({
      orgId: input.orgId,
      actorType: input.actorType ?? 'USER',
      actorId: input.userId,
      action: input.operation,
      targetType: 'ai',
      ...(input.detail ? { detail: input.detail } : {}),
    })
    .catch(() => {}); // telemetria nunca derruba a resposta do usuário

export interface AiActor {
  orgId: string;
  /** id do usuário humano ou da credencial de máquina, conforme `actorType` */
  userId: string;
  /** default USER; a superfície MCP passa MCP para a auditoria não mentir sobre quem gerou */
  actorType?: 'USER' | 'MCP';
}

// ---------------------------------------------------------------------------
// ai_caption — "IA: adapta o tom e o formato de cada rede" (plano Pro)
// ---------------------------------------------------------------------------

export interface CaptionVariant {
  channelId: string;
  text: string;
  maxLength: number;
  /** true = o modelo passou do limite e nós cortamos deterministicamente (design D7) */
  shortened: boolean;
}

export const makeGenerateCaption =
  (deps: AiDeps) =>
  async (
    actor: AiActor,
    input: { brief: string; channelIds: string[]; tone?: string; settings?: Record<string, unknown> },
  ): Promise<{ variants: CaptionVariant[] }> => {
    await deps.plan.assert(actor.orgId, { kind: 'feature', feature: 'ai_caption' });
    const brief = textoObrigatorio(input.brief, 'o brief');
    const canais = await carregarCanais(deps.channels, actor.orgId, input.channelIds);

    const variants = await withBudget(
      deps.budget,
      { orgId: actor.orgId, operation: 'ai.caption', credits: CUSTO.caption * canais.length },
      async () => {
        const usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
        const resultados: CaptionVariant[] = [];

        // uma chamada por canal: adaptar de verdade a cada rede é o que a landing promete,
        // e uma resposta única com N seções seria pior de validar por limite
        for (const canal of canais) {
          const brief_ = briefDoCanal(deps.registry, canal, input.settings);
          const { text, usage: u } = await deps.provider.generateText({
            system: prompts.captionSystem(),
            prompt: prompts.captionPrompt({
              brief,
              channel: brief_,
              ...(input.tone ? { tone: input.tone } : {}),
            }),
            maxTokens: tokensParaCaracteres(brief_.maxLength),
          });
          usage.inputTokens += u.inputTokens;
          usage.outputTokens += u.outputTokens;

          const cortado = shortenTo(text, brief_.maxLength);
          resultados.push({
            channelId: canal.id,
            text: cortado.text,
            maxLength: brief_.maxLength,
            shortened: cortado.shortened,
          });
        }
        return { result: resultados, usage };
      },
    );

    void auditar(deps, {
      ...actor,
      operation: 'ai.caption',
      detail: { channels: canais.length },
    });
    return { variants };
  };

export const makeRewriteText =
  (deps: AiDeps) =>
  async (
    actor: AiActor,
    input: {
      text: string;
      instruction: string;
      channelId: string;
      settings?: Record<string, unknown>;
    },
  ): Promise<CaptionVariant> => {
    await deps.plan.assert(actor.orgId, { kind: 'feature', feature: 'ai_caption' });
    const texto = textoObrigatorio(input.text, 'o texto');
    const instrucao = textoObrigatorio(input.instruction, 'a instrução');
    const [canal] = await carregarCanais(deps.channels, actor.orgId, [input.channelId]);
    const brief = briefDoCanal(deps.registry, canal!, input.settings);

    const variante = await withBudget(
      deps.budget,
      { orgId: actor.orgId, operation: 'ai.rewrite', credits: CUSTO.rewrite },
      async () => {
        const { text, usage } = await deps.provider.generateText({
          system: prompts.rewriteSystem(),
          prompt: prompts.rewritePrompt({ text: texto, instruction: instrucao, channel: brief }),
          maxTokens: tokensParaCaracteres(brief.maxLength),
        });
        const cortado = shortenTo(text, brief.maxLength);
        return {
          result: {
            channelId: canal!.id,
            text: cortado.text,
            maxLength: brief.maxLength,
            shortened: cortado.shortened,
          },
          usage,
        };
      },
    );

    void auditar(deps, { ...actor, operation: 'ai.rewrite' });
    return variante;
  };

export const makeSuggestHashtags =
  (deps: AiDeps) =>
  async (
    actor: AiActor,
    input: { text: string; channelId: string; count?: number },
  ): Promise<{ hashtags: string[] }> => {
    await deps.plan.assert(actor.orgId, { kind: 'feature', feature: 'ai_caption' });
    const texto = textoObrigatorio(input.text, 'o texto');
    const [canal] = await carregarCanais(deps.channels, actor.orgId, [input.channelId]);
    const count = Math.min(Math.max(input.count ?? 8, 1), 30);

    const hashtags = await withBudget(
      deps.budget,
      { orgId: actor.orgId, operation: 'ai.hashtags', credits: CUSTO.hashtags },
      async () => {
        const { text, usage } = await deps.provider.generateText({
          system: prompts.hashtagsSystem(),
          prompt: prompts.hashtagsPrompt({
            text: texto,
            network: nomeDaRede(deps.registry, canal!.provider),
            count,
          }),
          maxTokens: 300,
        });
        return { result: extrairHashtags(text, count), usage };
      },
    );

    void auditar(deps, { ...actor, operation: 'ai.hashtags' });
    return { hashtags };
  };

/**
 * Alt text a partir da mídia guardada. Depende de o adapter conseguir VER imagem — sem isso
 * recusamos explicitamente, porque descrever a partir do nome do arquivo seria pior que nada
 * para quem usa leitor de tela.
 */
export const makeGenerateAltText =
  (deps: AiDeps) =>
  async (
    actor: AiActor,
    input: { mediaId: string; context?: string; maxLength?: number },
  ): Promise<{ alt: string }> => {
    await deps.plan.assert(actor.orgId, { kind: 'feature', feature: 'ai_caption' });

    const [midia] = await deps.media.findMany(actor.orgId, [input.mediaId]);
    if (!midia) throw new DomainError(ErrorCodes.NotFound, 'mídia não encontrada');
    if (!midia.mime.startsWith('image/')) {
      throw new DomainError(
        ErrorCodes.MediaUnsupportedType,
        'a descrição automática só existe para imagem',
        { mime: midia.mime },
      );
    }
    if (!deps.provider.describeImage) {
      throw new DomainError(
        ErrorCodes.AiCapabilityUnavailable,
        'O modelo configurado nesta instalação não descreve imagens.',
      );
    }

    const maxLength = Math.min(Math.max(input.maxLength ?? 420, 60), 1000);
    const describeImage = deps.provider.describeImage;
    const imageUrl = deps.storage.publicUrl(midia.path);

    const alt = await withBudget(
      deps.budget,
      { orgId: actor.orgId, operation: 'ai.alt_text', credits: CUSTO.altText },
      async () => {
        const { text, usage } = await describeImage({
          imageUrl,
          mimeType: midia.mime,
          system: prompts.altTextSystem(),
          prompt: prompts.altTextPrompt({
            maxLength,
            ...(input.context ? { context: input.context } : {}),
          }),
          maxTokens: tokensParaCaracteres(maxLength),
        });
        return { result: shortenTo(text, maxLength).text, usage };
      },
    );

    void auditar(deps, { ...actor, operation: 'ai.alt_text', detail: { mediaId: input.mediaId } });
    return { alt };
  };

// ---------------------------------------------------------------------------
// ai_multichannel_draft — "IA: rascunho multicanal a partir de uma ideia" (Premium)
// ---------------------------------------------------------------------------

const DraftSchema = z.object({
  drafts: z
    .array(z.object({ channelId: z.string().min(1), text: z.string().min(1) }))
    .min(1),
});

export const makeDraftMultichannel =
  (deps: AiDeps) =>
  async (
    actor: AiActor,
    input: { idea: string; channelIds: string[]; tone?: string; settings?: Record<string, unknown> },
  ): Promise<{ drafts: CaptionVariant[] }> => {
    await deps.plan.assert(actor.orgId, { kind: 'feature', feature: 'ai_multichannel_draft' });
    const ideia = textoObrigatorio(input.idea, 'a ideia');
    const canais = await carregarCanais(deps.channels, actor.orgId, input.channelIds);
    const briefs = canais.map((c) => briefDoCanal(deps.registry, c, input.settings));

    const drafts = await withBudget(
      deps.budget,
      { orgId: actor.orgId, operation: 'ai.draft', credits: CUSTO.draft },
      async () => {
        const { text, usage } = await deps.provider.generateText({
          system: prompts.draftSystem(),
          prompt: prompts.draftPrompt({
            idea: ideia,
            channels: briefs,
            ...(input.tone ? { tone: input.tone } : {}),
          }),
          maxTokens: Math.min(4000, 400 + briefs.length * 400),
        });

        const parsed = lerEstrutura(text, DraftSchema);
        const porCanal = new Map(briefs.map((b) => [b.channelId, b]));

        // o modelo pode devolver id inventado ou repetido: só o que casa com um canal PEDIDO passa
        const vistos = new Set<string>();
        const resultado: CaptionVariant[] = [];
        for (const item of parsed.drafts) {
          const brief = porCanal.get(item.channelId);
          if (!brief || vistos.has(item.channelId)) continue;
          vistos.add(item.channelId);
          const cortado = shortenTo(item.text, brief.maxLength);
          resultado.push({
            channelId: brief.channelId,
            text: cortado.text,
            maxLength: brief.maxLength,
            shortened: cortado.shortened,
          });
        }
        if (resultado.length === 0) throw respostaInvalida();
        return { result: resultado, usage };
      },
    );

    void auditar(deps, { ...actor, operation: 'ai.draft', detail: { channels: canais.length } });
    return { drafts };
  };

// ---------------------------------------------------------------------------
// ai_calendar — "IA: monta e otimiza o calendário da semana" (Premium)
// ---------------------------------------------------------------------------

const WeekPlanSchema = z.object({
  slots: z
    .array(
      z.object({
        channelId: z.string().min(1),
        topic: z.string().min(1),
        text: z.string().min(1),
        dayOffset: z.number().int().min(0).max(6),
        hour: z.number().int().min(0).max(23),
      }),
    )
    .min(1),
});

export interface PlannedSlot {
  channelId: string;
  topic: string;
  text: string;
  /** momento proposto, em UTC — a UI mostra no fuso do usuário */
  publishAt: string;
  maxLength: number;
  shortened: boolean;
}

/**
 * Propõe uma semana. NÃO agenda, não cria rascunho e não enfileira nada: o resultado é material
 * que uma pessoa aceita (SPEC ai-content-generation). Escrever direto no banco esbarraria no
 * limite mensal de posts do Grátis de um jeito que merece decisão própria (design, questão 3).
 */
export const makePlanWeek =
  (deps: AiDeps) =>
  async (
    actor: AiActor,
    input: {
      goal: string;
      channelIds: string[];
      weekStart: Date;
      slots?: number;
      settings?: Record<string, unknown>;
    },
  ): Promise<{ slots: PlannedSlot[] }> => {
    await deps.plan.assert(actor.orgId, { kind: 'feature', feature: 'ai_calendar' });
    const objetivo = textoObrigatorio(input.goal, 'o objetivo');
    const canais = await carregarCanais(deps.channels, actor.orgId, input.channelIds);
    const briefs = canais.map((c) => briefDoCanal(deps.registry, c, input.settings));
    const quantidade = Math.min(Math.max(input.slots ?? 5, 1), 21);
    const inicio = inicioDoDiaUtc(input.weekStart);

    const slots = await withBudget(
      deps.budget,
      { orgId: actor.orgId, operation: 'ai.week_plan', credits: CUSTO.weekPlan },
      async () => {
        const { text, usage } = await deps.provider.generateText({
          system: prompts.weekPlanSystem(),
          prompt: prompts.weekPlanPrompt({
            goal: objetivo,
            channels: briefs,
            slots: quantidade,
            weekStartIso: inicio.toISOString().slice(0, 10),
          }),
          maxTokens: Math.min(6000, 600 + quantidade * 300),
        });

        const parsed = lerEstrutura(text, WeekPlanSchema);
        const porCanal = new Map(briefs.map((b) => [b.channelId, b]));

        const resultado: PlannedSlot[] = [];
        for (const slot of parsed.slots.slice(0, quantidade)) {
          const brief = porCanal.get(slot.channelId);
          if (!brief) continue; // id inventado pelo modelo não vira proposta
          const cortado = shortenTo(slot.text, brief.maxLength);
          resultado.push({
            channelId: brief.channelId,
            topic: slot.topic.trim(),
            text: cortado.text,
            // o schema já prende dayOffset a 0..6 e hour a 0..23: a proposta CAI na semana pedida
            publishAt: new Date(
              inicio.getTime() + slot.dayOffset * 86_400_000 + slot.hour * 3_600_000,
            ).toISOString(),
            maxLength: brief.maxLength,
            shortened: cortado.shortened,
          });
        }
        if (resultado.length === 0) throw respostaInvalida();
        return { result: resultado, usage };
      },
    );

    void auditar(deps, { ...actor, operation: 'ai.week_plan', detail: { slots: slots.length } });
    return { slots };
  };

// ---------------------------------------------------------------------------
// auxiliares
// ---------------------------------------------------------------------------

const respostaInvalida = () =>
  new DomainError(
    ErrorCodes.AiInvalidResponse,
    'O modelo respondeu num formato que não pôde ser lido. Tente de novo.',
  );

/**
 * Lê a saída estruturada e valida a forma. Falhar aqui levanta `ai.invalid_response` — e como
 * estamos dentro do `withBudget`, a franquia volta para a org (design D8). Não há re-pergunta
 * automática: dobraria o custo de um caso que quase sempre é modelo mal configurado.
 */
function lerEstrutura<T>(raw: string, schema: z.ZodType<T>): T {
  const parsed = parseStructured(raw);
  if (!parsed.ok) throw respostaInvalida();
  const validado = schema.safeParse(parsed.value);
  if (!validado.success) throw respostaInvalida();
  return validado.data;
}

/**
 * Quantos tokens a RESPOSTA precisa (pt-BR gira em torno de 3 caracteres por token).
 *
 * É uma declaração de necessidade, não um teto: quem limita o custo é o operador, por
 * `AI_MAX_OUTPUT_TOKENS`. Apertar o teto por requisição cortaria modelo de raciocínio no meio
 * da palavra, e não compraria nada — o tamanho por canal é garantido depois, pelo `shortenTo`.
 */
const tokensParaCaracteres = (maxLength: number): number =>
  Math.min(4000, Math.max(120, Math.ceil(maxLength / 3) + 120));

/** aceita "#a #b" e também lista em linhas ou com vírgula; normaliza e tira repetida */
function extrairHashtags(raw: string, count: number): string[] {
  const encontradas = raw.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  const unicas: string[] = [];
  const vistas = new Set<string>();
  for (const tag of encontradas) {
    const chave = tag.toLowerCase();
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    unicas.push(tag);
    if (unicas.length === count) break;
  }
  return unicas;
}

const inicioDoDiaUtc = (d: Date): Date =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** re-exportado para o composition root montar o bundle sem importar de dois lugares */
export type { PlanFeature };
