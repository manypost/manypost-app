import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { DomainError } from '@manypost/core';
import type { Container } from '../container';

/**
 * Servidor MCP do manypost (SPEC_API_MCP §5): expõe os MESMOS use-cases da API como tools —
 * nunca duplica regra. Uma instância é criada por requisição (transporte stateless), amarrada
 * ao `orgId`/`apiKeyId` da credencial autenticada (API key com escopo `mcp`). Toda tool que muta
 * grava `audit_log` com `actor_type=MCP`.
 *
 * Tools fora deste corte (features ainda inexistentes — §4): `get_channel_analytics`,
 * `generate_content`, `find_free_slot`.
 */
export interface McpPrincipal {
  orgId: string;
  apiKeyId: string;
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

type Group = NonNullable<Awaited<ReturnType<Container['posts']['getGroup']>>>;
const serializeGroup = (g: Group) => ({
  id: g.id,
  state: g.state,
  publishAt: g.publishAt?.toISOString() ?? null,
  publications: g.publications.map((p) => ({
    id: p.id,
    channelId: p.channelId,
    state: p.state,
    itemCount: p.itemCount ?? 1,
    lastPublishedIndex: p.lastPublishedIndex,
    externalId: p.externalId,
    releaseUrl: p.releaseUrl,
    errorClass: p.errorClass,
    errorMessage: p.errorMessage,
  })),
});

export function buildMcpServer(ctn: Container, principal: McpPrincipal): McpServer {
  const { orgId, apiKeyId } = principal;
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
        actorId: apiKeyId,
        action,
        targetType: 'post',
        ...(targetId ? { targetId } : {}),
        detail,
      })
      .catch(() => {}); // auditoria é best-effort — nunca derruba a tool

  // ---- leitura (mcp:read) ----
  server.registerTool(
    'list_channels',
    {
      title: 'Listar canais',
      description: 'Lista os canais de rede social conectados na organização (tokens nunca expostos).',
      inputSchema: {},
    },
    async () => {
      try {
        const channels = await ctn.channels.list(orgId);
        return ok(
          channels.map((c) => ({
            id: c.id,
            provider: c.provider,
            name: c.name,
            username: c.username,
            status: c.status,
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
      try {
        // política anti-loop de agente (§5): teto de 30 agendamentos/h por credencial
        const limiter = ctn.runtime.rateLimiter;
        if (limiter) {
          const verdict = await limiter.acquire([
            { key: `mcp:sched:${apiKeyId}`, limit: 30, windowSec: 3600 },
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

  return server;
}
