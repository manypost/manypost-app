import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { uuidv7 } from '../uuid';
import type { MediaRef, PublicationState } from '@manypost/contracts';
import type { PublicationView, PublishingRepository, TransitionPatch } from '@manypost/core';
import type { Db } from '../index';
import {
  approvalLinks,
  channels,
  postGroups,
  publicationAttempts,
  publicationEvents,
  publicationItems,
  publications,
} from '../schema';

const IN_FLIGHT: PublicationState[] = ['SCHEDULED', 'PUBLISHING', 'RETRYING', 'TOKEN_REFRESH'];

const toView = (row: typeof publications.$inferSelect): PublicationView => ({
  id: row.id,
  orgId: row.orgId,
  groupId: row.groupId,
  channelId: row.channelId,
  state: row.state,
  publishAt: row.publishAt,
  content: row.content as PublicationView['content'],
  settings: row.settings,
  attemptCount: row.attemptCount,
  jobVersion: row.jobVersion,
  lastPublishedIndex: row.lastPublishedIndex,
  externalId: row.externalId,
  releaseUrl: row.releaseUrl,
  errorClass: row.errorClass,
  errorMessage: row.errorMessage,
});

export function makePublishingRepository(db: Db): PublishingRepository {
  return {
    async createGroup(d) {
      const state = d.state ?? 'SCHEDULED';
      return db.transaction(async (tx) => {
        const [group] = await tx
          .insert(postGroups)
          .values({
            orgId: d.orgId,
            authorId: d.authorId,
            baseContent: d.baseContent,
            publishAt: d.publishAt,
            timezone: d.timezone,
            state,
            origin: d.origin,
          })
          .returning({ id: postGroups.id });

        const created: Array<{ id: string; channelId: string }> = [];
        for (const p of d.publications) {
          const [pub] = await tx
            .insert(publications)
            .values({
              orgId: d.orgId,
              groupId: group!.id,
              channelId: p.channelId,
              content: p.content,
              settings: p.settings,
              state,
              publishAt: d.publishAt,
            })
            .returning({ id: publications.id });
          await tx.insert(publicationItems).values(
            p.items.map((item, position) => ({
              publicationId: pub!.id,
              position,
              content: item.content,
              media: item.media,
              delaySec: item.delaySec,
            })),
          );
          created.push({ id: pub!.id, channelId: p.channelId });
        }
        return { groupId: group!.id, publications: created };
      });
    },

    async getGroup(orgId, groupId) {
      const [group] = await db
        .select()
        .from(postGroups)
        .where(and(eq(postGroups.id, groupId), eq(postGroups.orgId, orgId)))
        .limit(1);
      if (!group) return null;
      // atenção: ${publications.id} renderiza sem qualificação aqui e o escopo interno
      // da subquery capturaria o "id" de pi — qualificar a tabela é obrigatório
      const itemCount = sql<number>`(
        select count(*)::int from ${publicationItems} pi where pi.publication_id = ${publications}.id
      )`;
      const rows = await db
        .select({ pub: publications, itemCount })
        .from(publications)
        .where(eq(publications.groupId, groupId))
        .orderBy(asc(publications.createdAt));
      return {
        id: group.id,
        state: group.state,
        publishAt: group.publishAt,
        timezone: group.timezone,
        baseContent: group.baseContent,
        publications: rows.map((r) => ({ ...toView(r.pub), itemCount: r.itemCount })),
      };
    },

    async findForPublish(publicationId) {
      const [row] = await db
        .select({ pub: publications, ch: channels })
        .from(publications)
        .innerJoin(channels, eq(channels.id, publications.channelId))
        .where(eq(publications.id, publicationId))
        .limit(1);
      if (!row) return null;
      return {
        publication: toView(row.pub),
        channel: {
          id: row.ch.id,
          orgId: row.ch.orgId,
          provider: row.ch.provider,
          externalId: row.ch.externalId,
          name: row.ch.name,
          username: row.ch.username,
          avatarUrl: row.ch.avatarUrl,
          status: row.ch.status,
          scopes: row.ch.scopes,
          settings: row.ch.settings,
          tokenEnc: row.ch.tokenEnc,
          refreshTokenEnc: row.ch.refreshTokenEnc,
          tokenKeyVersion: row.ch.tokenKeyVersion,
          tokenExpiresAt: row.ch.tokenExpiresAt,
        },
      };
    },

    async transition(id, from, to, patch?: TransitionPatch) {
      // duas etapas: lê o estado e faz UPDATE condicional nele (fencing);
      // corrida entre workers é resolvida pelo WHERE — só um vence
      const [current] = await db
        .select({ state: publications.state })
        .from(publications)
        .where(eq(publications.id, id))
        .limit(1);
      if (!current || !from.includes(current.state)) return false;

      const rows = await db
        .update(publications)
        .set({
          state: to,
          ...(patch?.incrementAttempt ? { attemptCount: sql`${publications.attemptCount} + 1` } : {}),
          ...(patch?.resetAttempts ? { attemptCount: 0 } : {}),
          ...(patch?.bumpJobVersion ? { jobVersion: sql`${publications.jobVersion} + 1` } : {}),
          ...(patch?.attemptId ? { attemptId: sql`gen_random_uuid()` } : {}),
          ...(patch?.externalId !== undefined ? { externalId: patch.externalId } : {}),
          ...(patch?.releaseUrl !== undefined ? { releaseUrl: patch.releaseUrl } : {}),
          ...(patch?.errorClass !== undefined ? { errorClass: patch.errorClass } : {}),
          ...(patch?.errorMessage !== undefined ? { errorMessage: patch.errorMessage } : {}),
          ...(patch?.publishedAt ? { publishedAt: patch.publishedAt } : {}),
        })
        .where(and(eq(publications.id, id), eq(publications.state, current.state)))
        .returning({ id: publications.id });
      if (rows.length === 0) return false;

      await db.insert(publicationEvents).values({
        publicationId: id,
        fromState: current.state,
        toState: to,
        detail: patch?.errorMessage ? { error: patch.errorMessage.slice(0, 500) } : {},
      });
      return true;
    },

    async listItems(publicationId) {
      const rows = await db
        .select()
        .from(publicationItems)
        .where(eq(publicationItems.publicationId, publicationId))
        .orderBy(asc(publicationItems.position));
      return rows.map((r) => ({
        id: r.id,
        position: r.position,
        content: r.content as { text: string },
        media: r.media as MediaRef[],
        delaySec: r.delaySec,
        externalId: r.externalId,
      }));
    },

    async claimItem({ publicationId, jobVersion, position, leaseSec }) {
      // UMA instrução: valida a publicação viva (estado, versão e cursor) na origem do INSERT e
      // toma a posse no mesmo passo. Reivindicar de novo o MESMO item lógico cai no ON CONFLICT e
      // só passa quando a tentativa anterior falhou em segurança ou a lease expirou — por isso
      // CONFIRMED e INDETERMINATE são intransponíveis, e a idempotency_key nunca é reescrita.
      const rows = await db.execute<{
        id: string;
        owner_token: string;
        idempotency_key: string;
        attempt_count: number;
      }>(sql`
        INSERT INTO publication_attempts
          (id, org_id, publication_id, job_version, position, state, owner_token, lease_expires_at,
           idempotency_key, attempt_count)
        SELECT ${uuidv7()}::uuid, p.org_id, p.id, p.job_version, ${position}::int, 'CLAIMED'::attempt_state,
               ${randomUUID()}::text, now() + (${leaseSec}::int * interval '1 second'),
               encode(
                 sha256(convert_to(
                   p.id::text || ':' || p.job_version::text || ':' || ${position}::int::text, 'UTF8')),
                 'hex'),
               1
        FROM publications p
        WHERE p.id = ${publicationId}::uuid
          AND p.job_version = ${jobVersion}::int
          AND p.state = 'PUBLISHING'
          AND p.last_published_index = ${position}::int - 1
        ON CONFLICT (publication_id, job_version, position) DO UPDATE
          SET owner_token = excluded.owner_token,
              state = 'CLAIMED'::attempt_state,
              lease_expires_at = excluded.lease_expires_at,
              attempt_count = publication_attempts.attempt_count + 1,
              updated_at = now()
          WHERE publication_attempts.state = 'FAILED_SAFE'::attempt_state
             OR (publication_attempts.state = 'CLAIMED'::attempt_state
                 AND publication_attempts.lease_expires_at < now())
        RETURNING id, owner_token, idempotency_key, attempt_count
      `);
      const row = rows[0];
      if (!row) return null;
      return {
        attemptId: row.id,
        ownerToken: row.owner_token,
        idempotencyKey: row.idempotency_key,
        attemptCount: Number(row.attempt_count),
      };
    },

    async confirmItem(publicationId, itemId, position, ownerToken, d) {
      return db.transaction(async (tx) => {
        // fencing por posse: quem foi substituído por outro dono não confirma nada. Não é
        // preciso revalidar estado/versão da publicação aqui — enquanto há posse viva ela está
        // PUBLISHING, e PUBLISHING não pode ser cancelada nem editada.
        const owned = await tx
          .update(publicationAttempts)
          .set({ state: 'CONFIRMED', externalId: d.externalId })
          .where(
            and(
              eq(publicationAttempts.publicationId, publicationId),
              eq(publicationAttempts.position, position),
              eq(publicationAttempts.ownerToken, ownerToken),
              eq(publicationAttempts.state, 'CLAIMED'),
            ),
          )
          .returning({ id: publicationAttempts.id });
        if (owned.length === 0) return false;

        await tx
          .update(publicationItems)
          .set({ externalId: d.externalId })
          .where(eq(publicationItems.id, itemId));
        // cursor monotônico: só avança do índice imediatamente anterior (idempotente sob jobs duplicados)
        await tx
          .update(publications)
          .set({
            lastPublishedIndex: position,
            ...(position === 0
              ? {
                  externalId: d.externalId,
                  ...(d.releaseUrl !== undefined ? { releaseUrl: d.releaseUrl } : {}),
                }
              : {}),
          })
          .where(
            and(eq(publications.id, publicationId), eq(publications.lastPublishedIndex, position - 1)),
          );
        return true;
      });
    },

    async releaseItem(ownerToken, outcome) {
      await db
        .update(publicationAttempts)
        .set({ state: outcome })
        .where(
          and(
            eq(publicationAttempts.ownerToken, ownerToken),
            eq(publicationAttempts.state, 'CLAIMED'),
          ),
        );
    },

    async abandonAttempts(orgId, publicationId) {
      const rows = await db
        .update(publicationAttempts)
        .set({ state: 'INDETERMINATE' })
        .where(
          and(
            eq(publicationAttempts.orgId, orgId),
            eq(publicationAttempts.publicationId, publicationId),
            eq(publicationAttempts.state, 'CLAIMED'),
          ),
        )
        .returning({ id: publicationAttempts.id });
      return rows.length;
    },

    async listDue(before, limit) {
      return db
        .select({ id: publications.id, jobVersion: publications.jobVersion })
        .from(publications)
        .where(and(eq(publications.state, 'SCHEDULED'), lte(publications.publishAt, before)))
        .orderBy(asc(publications.publishAt))
        .limit(limit);
    },

    async rescheduleGroup(orgId, groupId, d) {
      // merge jsonb (||): editar só o texto preserva a mídia anexada, e vice-versa
      const contentPatch = d.baseContent ? JSON.stringify(d.baseContent) : null;
      return db.transaction(async (tx) => {
        await tx
          .update(postGroups)
          .set({
            ...(contentPatch
              ? { baseContent: sql`${postGroups.baseContent} || ${contentPatch}::jsonb` }
              : {}),
            ...(d.publishAt ? { publishAt: d.publishAt } : {}),
            state: 'SCHEDULED',
          })
          .where(and(eq(postGroups.id, groupId), eq(postGroups.orgId, orgId)));
        const rows = await tx
          .update(publications)
          .set({
            state: 'SCHEDULED',
            attemptCount: 0,
            jobVersion: sql`${publications.jobVersion} + 1`,
            errorClass: null,
            errorMessage: null,
            ...(contentPatch
              ? { content: sql`${publications.content} || ${contentPatch}::jsonb` }
              : {}),
            ...(d.publishAt ? { publishAt: d.publishAt } : {}),
          })
          .where(
            and(
              eq(publications.groupId, groupId),
              eq(publications.orgId, orgId),
              inArray(publications.state, ['SCHEDULED', 'RETRYING', 'TOKEN_REFRESH']),
            ),
          )
          .returning({
            id: publications.id,
            channelId: publications.channelId,
            jobVersion: publications.jobVersion,
            publishAt: publications.publishAt,
          });
        // settings por canal: merge jsonb (||) nas publicações já re-agendadas (SCHEDULED)
        for (const [channelId, settings] of Object.entries(d.settingsByChannel ?? {})) {
          await tx
            .update(publications)
            .set({ settings: sql`${publications.settings} || ${JSON.stringify(settings)}::jsonb` })
            .where(
              and(
                eq(publications.groupId, groupId),
                eq(publications.orgId, orgId),
                eq(publications.channelId, channelId),
                eq(publications.state, 'SCHEDULED'),
              ),
            );
        }
        return rows.map((r) => ({ ...r, publishAt: r.publishAt ?? d.publishAt ?? new Date() }));
      });
    },

    async updateDraftGroup(orgId, groupId, d) {
      const contentPatch = d.baseContent ? JSON.stringify(d.baseContent) : null;
      return db.transaction(async (tx) => {
        const rows = await tx
          .update(postGroups)
          .set({
            ...(contentPatch
              ? { baseContent: sql`${postGroups.baseContent} || ${contentPatch}::jsonb` }
              : {}),
            ...(d.publishAt ? { publishAt: d.publishAt } : {}),
          })
          .where(
            and(eq(postGroups.id, groupId), eq(postGroups.orgId, orgId), eq(postGroups.state, 'DRAFT')),
          )
          .returning({ id: postGroups.id });
        if (rows.length === 0) return false;
        await tx
          .update(publications)
          .set({
            ...(contentPatch
              ? { content: sql`${publications.content} || ${contentPatch}::jsonb` }
              : {}),
            ...(d.publishAt ? { publishAt: d.publishAt } : {}),
          })
          .where(and(eq(publications.groupId, groupId), eq(publications.state, 'DRAFT')));
        // settings por canal: merge jsonb (||) nas publicações DRAFT
        for (const [channelId, settings] of Object.entries(d.settingsByChannel ?? {})) {
          await tx
            .update(publications)
            .set({ settings: sql`${publications.settings} || ${JSON.stringify(settings)}::jsonb` })
            .where(
              and(
                eq(publications.groupId, groupId),
                eq(publications.orgId, orgId),
                eq(publications.channelId, channelId),
                eq(publications.state, 'DRAFT'),
              ),
            );
        }
        return true;
      });
    },

    async scheduleDraftGroup(orgId, groupId) {
      return db.transaction(async (tx) => {
        // condicional no estado (fencing): grupo cancelado/já agendado = no-op
        const groups = await tx
          .update(postGroups)
          .set({ state: 'SCHEDULED' })
          .where(
            and(eq(postGroups.id, groupId), eq(postGroups.orgId, orgId), eq(postGroups.state, 'DRAFT')),
          )
          .returning({ id: postGroups.id });
        if (groups.length === 0) return [];
        const rows = await tx
          .update(publications)
          .set({ state: 'SCHEDULED' })
          .where(and(eq(publications.groupId, groupId), eq(publications.state, 'DRAFT')))
          .returning({
            id: publications.id,
            channelId: publications.channelId,
            jobVersion: publications.jobVersion,
            publishAt: publications.publishAt,
          });
        if (rows.length > 0) {
          await tx.insert(publicationEvents).values(
            rows.map((r) => ({
              publicationId: r.id,
              fromState: 'DRAFT' as const,
              toState: 'SCHEDULED' as const,
              detail: { via: 'approval_link' },
            })),
          );
        }
        return rows;
      });
    },

    async listPublicationsFeed(orgId, q) {
      const conds = [eq(publications.orgId, orgId)];
      if (q.from) conds.push(gte(publications.publishAt, q.from));
      if (q.to) conds.push(lte(publications.publishAt, q.to));
      if (q.states?.length) conds.push(inArray(publications.state, q.states));
      if (q.channelIds?.length) conds.push(inArray(publications.channelId, q.channelIds));
      if (q.cursor) {
        // keyset por (publish_at, id) — estável sob inserções entre páginas.
        // ISO + cast explícito: num sql`` cru o drizzle não infere o tipo do Date
        conds.push(
          sql`(${publications.publishAt}, ${publications.id}) > (${q.cursor.publishAt.toISOString()}::timestamptz, ${q.cursor.id}::uuid)`,
        );
      }
      const awaitingApproval = sql<boolean>`exists (
        select 1 from ${approvalLinks} al
        where al.group_id = ${publications}.group_id
          and al.status = 'PENDING' and al.expires_at > now()
      )`;
      const rows = await db
        .select({ pub: publications, group: postGroups, ch: channels, awaitingApproval })
        .from(publications)
        .innerJoin(postGroups, eq(postGroups.id, publications.groupId))
        .innerJoin(channels, eq(channels.id, publications.channelId))
        .where(and(...conds))
        .orderBy(asc(publications.publishAt), asc(publications.id))
        .limit(q.limit);
      return rows.map((r) => ({
        id: r.pub.id,
        groupId: r.pub.groupId,
        channelId: r.pub.channelId,
        state: r.pub.state,
        publishAt: r.pub.publishAt,
        content: r.pub.content as { text: string },
        externalId: r.pub.externalId,
        releaseUrl: r.pub.releaseUrl,
        errorClass: r.pub.errorClass,
        errorMessage: r.pub.errorMessage,
        attemptCount: r.pub.attemptCount,
        group: {
          state: r.group.state,
          origin: r.group.origin,
          awaitingApproval: r.awaitingApproval,
        },
        channel: {
          provider: r.ch.provider,
          name: r.ch.name,
          username: r.ch.username,
          avatarUrl: r.ch.avatarUrl,
        },
      }));
    },

    async listStuck(updatedBefore, limit) {
      const rows = await db
        .select({ id: publications.id, orgId: publications.orgId, state: publications.state })
        .from(publications)
        .where(
          and(
            inArray(publications.state, ['PUBLISHING', 'RETRYING', 'TOKEN_REFRESH']),
            lte(publications.updatedAt, updatedBefore),
          ),
        )
        .limit(limit);
      return rows;
    },

    async refreshGroupState(groupId) {
      const rows = await db
        .select({ state: publications.state, n: sql<number>`count(*)::int` })
        .from(publications)
        .where(eq(publications.groupId, groupId))
        .groupBy(publications.state);
      const total = rows.reduce((s, r) => s + r.n, 0);
      const by = (s: PublicationState) => rows.find((r) => r.state === s)?.n ?? 0;
      const inFlight = IN_FLIGHT.reduce((s, st) => s + by(st), 0);

      let state: 'SCHEDULED' | 'DONE' | 'PARTIAL' | 'CANCELLED' = 'SCHEDULED';
      if (inFlight === 0) {
        if (by('PUBLISHED') === total) state = 'DONE';
        else if (by('CANCELLED') === total) state = 'CANCELLED';
        else state = 'PARTIAL';
      }
      await db.update(postGroups).set({ state }).where(eq(postGroups.id, groupId));
    },

    /**
     * Contagens da tela inicial numa ida só ao banco (SPEC home-operational-overview).
     *
     * Três decisões que valem registro:
     *
     * 1. **Uma consulta, não sete.** Tudo sai de agregações condicionais sobre `publications` mais
     *    dois `exists`, porque a home abre a cada visita. Contar percorrendo o feed paginado
     *    custaria uma varredura por página.
     * 2. **`org_id` em TODA ramificação** (AGENTS.md, multi-tenant): o filtro está no `where` da
     *    consulta principal e repetido dentro de cada subconsulta — agregado é exatamente o lugar
     *    onde um vazamento passaria despercebido, porque ninguém vê a linha, só o número.
     * 3. **O corte por dia acontece no Postgres, no fuso do usuário** (`at time zone`). Fatiar em
     *    JS exigiria trazer todas as publicações da semana só para contá-las.
     */
    async summarize(orgId, w) {
      const [linha] = await db.execute<{
        failed: number;
        needs_review: number;
        partial: number;
        today_scheduled: number;
        today_published: number;
        today_failed: number;
        ever_scheduled: boolean;
      }>(sql`
        select
          count(*) filter (where p.state = 'FAILED')::int                        as failed,
          count(*) filter (where p.state = 'NEEDS_REVIEW')::int                  as needs_review,
          count(distinct g.id) filter (where g.state = 'PARTIAL')::int           as partial,
          count(*) filter (
            where p.state = ${'SCHEDULED'} and p.publish_at >= ${w.dayStart.toISOString()}::timestamptz
              and p.publish_at < ${w.dayStart.toISOString()}::timestamptz + interval '1 day'
          )::int                                                                 as today_scheduled,
          count(*) filter (
            where p.state = 'PUBLISHED' and p.published_at >= ${w.dayStart.toISOString()}::timestamptz
              and p.published_at < ${w.dayStart.toISOString()}::timestamptz + interval '1 day'
          )::int                                                                 as today_published,
          count(*) filter (
            where p.state = 'FAILED' and p.updated_at >= ${w.dayStart.toISOString()}::timestamptz
              and p.updated_at < ${w.dayStart.toISOString()}::timestamptz + interval '1 day'
          )::int                                                                 as today_failed,
          (count(*) > 0)                                                         as ever_scheduled
        from ${publications} p
        join ${postGroups} g on g.id = p.group_id
        where p.org_id = ${orgId}::uuid
      `);

      // aguardando aprovação: um link PENDENTE por GRUPO, não por publicação
      const [aprovacao] = await db.execute<{ n: number }>(sql`
        select count(distinct al.group_id)::int as n
        from ${approvalLinks} al
        join ${postGroups} g on g.id = al.group_id
        where g.org_id = ${orgId}::uuid and al.status = 'PENDING' and al.expires_at > now()
      `);

      // próximos 7 dias, um bucket por dia CIVIL do fuso pedido
      const porDia = await db.execute<{ dia: number; n: number }>(sql`
        select
          extract(day from date_trunc('day', p.publish_at at time zone ${w.timezone})
                         - date_trunc('day', ${w.dayStart.toISOString()}::timestamptz at time zone ${w.timezone}))::int as dia,
          count(*)::int as n
        from ${publications} p
        where p.org_id = ${orgId}::uuid
          and p.state = 'SCHEDULED'
          and p.publish_at >= ${w.dayStart.toISOString()}::timestamptz
          and p.publish_at < ${w.weekEnd.toISOString()}::timestamptz
        group by 1
      `);

      const weekByDay = Array.from({ length: 7 }, () => 0);
      for (const r of porDia) {
        if (r.dia >= 0 && r.dia < 7) weekByDay[r.dia] = r.n;
      }

      return {
        failed: linha?.failed ?? 0,
        needsReview: linha?.needs_review ?? 0,
        awaitingApproval: aprovacao?.n ?? 0,
        partial: linha?.partial ?? 0,
        todayScheduled: linha?.today_scheduled ?? 0,
        todayPublished: linha?.today_published ?? 0,
        todayFailed: linha?.today_failed ?? 0,
        weekByDay,
        everScheduled: linha?.ever_scheduled ?? false,
      };
    },

    async countGroupsSince(orgId, since) {
      // conta POSTS (grupos), não publicações: "15 posts por mês" no Grátis é por post,
      // independente de quantas redes ele saiu. Cancelado continua contando (consumiu a cota).
      const [row] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(postGroups)
        .where(and(eq(postGroups.orgId, orgId), gte(postGroups.createdAt, since)));
      return row?.n ?? 0;
    },

    async listDeliveredTimes(orgId, channelId, since, limit) {
      // Só o que REALMENTE saiu (PUBLISHED): agendado-e-cancelado ou falho não diz nada sobre
      // horário bom. Usa `published_at` (quando chegou à rede), não `publish_at` (quando foi
      // pedido) — é o instante que de fato aconteceu. O filtro por org é explícito ALÉM do
      // canal: canal de outra org não pode contribuir nem por engano (multi-tenant, AGENTS.md).
      const rows = await db
        .select({ publishedAt: publications.publishedAt })
        .from(publications)
        .where(
          and(
            eq(publications.orgId, orgId),
            eq(publications.channelId, channelId),
            eq(publications.state, 'PUBLISHED'),
            gte(publications.publishedAt, since),
          ),
        )
        .orderBy(desc(publications.publishedAt))
        .limit(limit);
      return rows.map((r) => r.publishedAt).filter((d): d is Date => d !== null);
    },
  };
}
