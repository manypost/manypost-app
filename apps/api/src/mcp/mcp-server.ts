import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  DomainError,
  IMAGE_QUALITY_MODES,
  hasMcpReadScope,
  hasMcpWriteScope,
} from '@manypost/core';
import type { Container } from '../container';
import { serializeGroup } from '../http/routes/shared/serialize';

/**
 * Servidor MCP do manypost (SPEC_API_MCP §5): expõe os MESMOS use-cases da API como tools —
 * nunca duplica regra. Amarrado ao `orgId`/`credentialId` da credencial (API key ou OAuth).
 * Toda tool que muta grava `audit_log` com `actor_type=MCP`.
 */
export interface McpPrincipal {
  orgId: string;
  /** apiKeyId ou grantId — rate-limit e auditoria */
  credentialId: string;
  scopes: string[];
}

const ok = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
});
const fail = (err: unknown) => {
  const code = err instanceof DomainError ? err.code : 'internal_error';
  const message = err instanceof Error ? err.message : String(err);
  return {
    isError: true as const,
    content: [{ type: 'text' as const, text: JSON.stringify({ error: code, message }) }],
  };
};

function denyScope(kind: 'read' | 'write') {
  return fail(
    new DomainError(
      'common.forbidden',
      kind === 'read'
        ? 'escopo insuficiente: mcp:read (ou mcp legado) exigido'
        : 'escopo insuficiente: mcp:write (ou mcp legado) exigido',
    ),
  );
}

// a mesma serialização do REST — o agente MCP vê o MESMO post, incluindo media e attemptCount
// (spec machine-api-contract: superfície não redeclara forma de entidade compartilhada)

export function buildMcpServer(ctn: Container, principal: McpPrincipal): McpServer {
  const { orgId, credentialId, scopes } = principal;
  const server = new McpServer(
    { name: 'manypost', version: '0.0.1' },
    {
      instructions:
        'Agendamento/publicação multicanal do manypost. Liste canais e posts, agende/edite/cancele posts e importe mídia por URL. Horários em ISO 8601.',
    },
  );

  const audit = (action: string, detail: Record<string, unknown>, targetId?: string) =>
    ctn.repos.audit
      .append({
        orgId,
        actorType: 'MCP',
        actorId: credentialId,
        action,
        targetType: 'post',
        ...(targetId ? { targetId } : {}),
        detail,
      })
      .catch(() => {});

  const requireRead = () => hasMcpReadScope(scopes);
  const requireWrite = () => hasMcpWriteScope(scopes);

  // ---- leitura (mcp:read) ----
  server.registerTool(
    'list_channels',
    {
      title: 'Listar canais',
      description: 'Lista os canais de rede social conectados na organização (tokens nunca expostos).',
      inputSchema: {},
    },
    async () => {
      if (!requireRead()) return denyScope('read');
      try {
        const channels = await ctn.channels.list(orgId);
        return ok(
          channels.map((ch) => ({
            id: ch.id,
            provider: ch.provider,
            name: ch.name,
            username: ch.username,
            status: ch.status,
          })),
        );
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    'list_posts',
    {
      title: 'Listar posts',
      description:
        'Feed de publicações (uma linha por canal). Filtra por estados (csv), período e limite.',
      inputSchema: {
        state: z.string().optional().describe('estados csv, ex.: SCHEDULED,PUBLISHED'),
        from: z.string().datetime().optional().describe('início ISO 8601'),
        to: z.string().datetime().optional().describe('fim ISO 8601'),
        limit: z.number().int().min(1).max(200).optional().describe('default 50'),
      },
    },
    async ({ state, from, to, limit }) => {
      if (!requireRead()) return denyScope('read');
      try {
        const rows = await ctn.posts.feed(orgId, {
          ...(from ? { from: new Date(from) } : {}),
          ...(to ? { to: new Date(to) } : {}),
          ...(state ? { states: state.split(',').filter(Boolean) as never } : {}),
          limit: limit ?? 50,
        });
        return ok(
          rows.map((p) => ({
            id: p.id,
            groupId: p.groupId,
            channelId: p.channelId,
            state: p.state,
            publishAt: p.publishAt?.toISOString() ?? null,
            text: p.content.text,
            releaseUrl: p.releaseUrl,
            groupState: p.group.state,
          })),
        );
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    'get_post',
    {
      title: 'Detalhe do post',
      description: 'Estados por canal e progresso de thread de um grupo de post.',
      inputSchema: { groupId: z.string().uuid() },
    },
    async ({ groupId }) => {
      if (!requireRead()) return denyScope('read');
      try {
        const group = await ctn.posts.getGroup(orgId, groupId);
        if (!group) throw new DomainError('common.not_found', 'post não encontrado');
        return ok(serializeGroup(group));
      } catch (err) {
        return fail(err);
      }
    },
  );

  // ---- mutação (mcp:write) ----
  server.registerTool(
    'schedule_post',
    {
      title: 'Agendar post',
      description:
        'Agenda um post (1 grupo → 1 publicação por canal). Valida texto/mídia por canal. `requireApproval` nasce rascunho aguardando link de aprovação. Limite: 30 agendamentos/hora por credencial.',
      inputSchema: {
        text: z.string().min(1).max(10_000),
        channelIds: z.array(z.string().uuid()).min(1).max(20),
        publishAt: z.string().datetime().describe('quando publicar (ISO 8601)'),
        timezone: z.string().optional().describe('fuso IANA, default UTC'),
        mediaIds: z.array(z.string().uuid()).max(10).optional(),
        requireApproval: z.boolean().optional(),
      },
    },
    async ({ text, channelIds, publishAt, timezone, mediaIds, requireApproval }) => {
      if (!requireWrite()) return denyScope('write');
      try {
        // política anti-loop de agente (§5): teto de 30 agendamentos/h por credencial
        const limiter = ctn.runtime.rateLimiter;
        if (limiter) {
          const verdict = await limiter.acquire([
            { key: `mcp:sched:${credentialId}`, limit: 30, windowSec: 3600 },
          ]);
          if (!verdict.ok) {
            throw new DomainError(
              'rate.limited',
              `limite de 30 agendamentos/hora atingido — tente em ~${verdict.retryAfterSec}s`,
            );
          }
        }
        const group = await ctn.posts.schedule({
          orgId,
          authorId: null,
          text,
          channelIds,
          publishAt: new Date(publishAt),
          timezone: timezone ?? 'UTC',
          origin: 'MCP',
          ...(mediaIds ? { mediaIds } : {}),
          ...(requireApproval ? { requireApproval: true } : {}),
        });
        await audit('mcp.schedule_post', { channelIds, requireApproval: !!requireApproval }, group!.id);
        return ok(serializeGroup(group!));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    'update_post',
    {
      title: 'Editar post',
      description: 'Edita texto e/ou horário de um grupo agendado (re-agenda com nova versão de job).',
      inputSchema: {
        groupId: z.string().uuid(),
        text: z.string().min(1).max(10_000).optional(),
        publishAt: z.string().datetime().optional(),
      },
    },
    async ({ groupId, text, publishAt }) => {
      if (!requireWrite()) return denyScope('write');
      try {
        if (text === undefined && publishAt === undefined) {
          throw new DomainError('validation.invalid_request', 'informe text e/ou publishAt');
        }
        const group = await ctn.posts.reschedule({
          orgId,
          groupId,
          ...(text !== undefined ? { text } : {}),
          ...(publishAt ? { publishAt: new Date(publishAt) } : {}),
        });
        await audit('mcp.update_post', { text: text !== undefined, publishAt: !!publishAt }, groupId);
        return ok(serializeGroup(group!));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    'cancel_post',
    {
      title: 'Cancelar post',
      description: 'Cancela um grupo agendado (o job antigo morre por versão).',
      inputSchema: { groupId: z.string().uuid() },
    },
    async ({ groupId }) => {
      if (!requireWrite()) return denyScope('write');
      try {
        const group = await ctn.posts.cancel(orgId, groupId);
        await audit('mcp.cancel_post', {}, groupId);
        return ok(serializeGroup(group!));
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    'upload_media_from_url',
    {
      title: 'Importar mídia por URL',
      description: 'Baixa uma mídia por URL (anti-SSRF) e a adiciona à biblioteca; devolve o mediaId.',
      inputSchema: {
        url: z.string().url(),
        alt: z.string().max(1500).optional().describe('texto alternativo'),
      },
    },
    async ({ url, alt }) => {
      if (!requireWrite()) return denyScope('write');
      try {
        const record = await ctn.media.fromUrl({ orgId, url, ...(alt ? { alt } : {}) });
        await audit('mcp.upload_media_from_url', { url }, record.id);
        return ok({
          id: record.id,
          url: ctn.storage.publicUrl(record.path),
          mime: record.mime,
          byteSize: record.byteSize,
        });
      } catch (err) {
        return fail(err);
      }
    },
  );

  // ---- IA (SPEC_API_MCP / SPEC_AI §3) ----
  //
  // Exige escopo de ESCRITA mesmo sem mutar dado do usuário: gerar consome a franquia paga da
  // organização, e uma credencial "só leitura" não pode queimar crédito de ninguém.
  server.registerTool(
    'generate_content',
    {
      title: 'Gerar conteúdo com IA',
      description:
        'Gera uma legenda por canal a partir de um brief, adaptada a cada rede e sempre dentro ' +
        'do limite dela. Requer a feature de IA no plano e franquia disponível. Devolve texto ' +
        'para revisão — NÃO agenda nem publica nada.',
      inputSchema: {
        brief: z.string().min(1).max(4000).describe('o que o post precisa dizer'),
        channelIds: z.array(z.string().uuid()).min(1).max(20).describe('canais de destino'),
        tone: z.string().max(120).optional().describe('tom desejado, ex.: "direto", "acolhedor"'),
      },
    },
    async ({ brief, channelIds, tone }) => {
      if (!requireWrite()) return denyScope('write');
      if (!ctn.ai) {
        return fail(
          new DomainError('capability.disabled', 'Esta instalação não tem IA configurada.'),
        );
      }
      try {
        const out = await ctn.ai.caption(
          { orgId, userId: credentialId, actorType: 'MCP' },
          { brief, channelIds, ...(tone ? { tone } : {}) },
        );
        return ok(out.variants);
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    'generate_image',
    {
      title: 'Gerar imagem com IA',
      description:
        'Gera uma imagem a partir de uma descrição e a guarda na biblioteca de mídia da ' +
        'organização, marcada como gerada por IA. A forma é uma PROPORÇÃO (1:1, 4:5, 9:16, 16:9, ' +
        '1.91:1) ou o canal de destino, que decide a proporção da rede dele. O modo economy custa ' +
        '2 créditos; quality custa 5. Sem modo, usa economy. NÃO publica nada: a imagem fica na ' +
        'biblioteca para uma pessoa usar.',
      inputSchema: {
        prompt: z.string().min(1).max(2000).describe('o que a imagem deve mostrar'),
        aspect: z
          .enum(['1:1', '4:5', '9:16', '16:9', '1.91:1'])
          .optional()
          .describe('proporção; sem ela, o canal decide; sem os dois, 1:1'),
        channelId: z.string().uuid().optional().describe('canal de destino, para escolher a forma'),
        mode: z
          .enum(IMAGE_QUALITY_MODES)
          .optional()
          .describe('economy (2 créditos, rápido) ou quality (5 créditos, resultado final)'),
        alt: z.string().max(1000).optional().describe('descrição para leitor de tela'),
      },
    },
    async ({ prompt, aspect, channelId, mode, alt }) => {
      // escopo de ESCRITA mesmo sem mutar conteúdo do usuário: gerar imagem queima a franquia
      // paga da organização, e credencial só-leitura não pode gastar crédito
      if (!requireWrite()) return denyScope('write');
      if (!ctn.aiImage.enabled) {
        return fail(
          new DomainError(
            'ai.capability_unavailable',
            'O provedor configurado nesta instalação não gera imagens.',
          ),
        );
      }
      try {
        const { media } = await ctn.aiImage.generate(
          { orgId, userId: credentialId, actorType: 'MCP' },
          {
            prompt,
            ...(aspect ? { aspect } : {}),
            ...(channelId ? { channelId } : {}),
            ...(mode ? { mode } : {}),
            ...(alt ? { alt } : {}),
          },
        );
        return ok({
          id: media.id,
          url: ctn.storage.publicUrl(media.path),
          mime: media.mime,
          width: media.width,
          height: media.height,
          source: media.source,
        });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.registerTool(
    'suggest_best_times',
    {
      title: 'Sugerir horários de publicação',
      description:
        'Sugere horários para um canal a partir do histórico da própria organização mais uma ' +
        'linha de base por rede. Não usa modelo e não consome franquia; `confidence` e ' +
        '`sampleSize` dizem o quanto a resposta vale.',
      inputSchema: {
        channelId: z.string().uuid(),
        timezone: z.string().optional().describe('IANA, ex.: America/Sao_Paulo'),
        limit: z.number().int().min(1).max(21).optional(),
      },
    },
    async ({ channelId, timezone, limit }) => {
      if (!requireRead()) return denyScope('read');
      try {
        return ok(
          await ctn.bestTimes(
            { orgId },
            {
              channelId,
              ...(timezone ? { timezone } : {}),
              ...(limit ? { limit } : {}),
            },
          ),
        );
      } catch (err) {
        return fail(err);
      }
    },
  );

  return server;
}
