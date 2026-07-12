import { and, asc, eq, inArray, lte, sql } from 'drizzle-orm';
import type { MediaRef, PublicationState } from '@manypost/contracts';
import type { PublicationView, PublishingRepository, TransitionPatch } from '@manypost/core';
import type { Db } from '../index';
import { channels, postGroups, publicationEvents, publicationItems, publications } from '../schema';

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
      return db.transaction(async (tx) => {
        const [group] = await tx
          .insert(postGroups)
          .values({
            orgId: d.orgId,
            authorId: d.authorId,
            baseContent: d.baseContent,
            publishAt: d.publishAt,
            timezone: d.timezone,
            state: 'SCHEDULED',
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
              state: 'SCHEDULED',
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

    async recordItemPublished(publicationId, itemId, position, d) {
      await db.transaction(async (tx) => {
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
      });
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
        return rows.map((r) => ({ ...r, publishAt: r.publishAt ?? d.publishAt ?? new Date() }));
      });
    },

    async listStuck(updatedBefore, limit) {
      const rows = await db
        .select({ id: publications.id, state: publications.state })
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
  };
}
