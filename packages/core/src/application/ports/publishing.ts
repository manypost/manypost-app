import type {
  ChannelStatus,
  GroupState,
  MediaRef,
  PostOrigin,
  PublicationState,
} from '@manypost/contracts';

/** Documento de conteúdo persistido em post_groups.base_content e publications.content. */
export interface PostContent {
  text: string;
  media?: MediaRef[];
}

export interface ChannelRecord {
  id: string;
  orgId: string;
  provider: string;
  externalId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  status: ChannelStatus;
  scopes: string[];
  settings: unknown;
  tokenEnc: Uint8Array;
  refreshTokenEnc: Uint8Array | null;
  tokenKeyVersion: number;
  tokenExpiresAt: Date | null;
}

export interface ChannelRepository {
  upsert(
    data: Omit<ChannelRecord, 'id' | 'status'> & { status?: ChannelStatus },
  ): Promise<ChannelRecord>;
  list(orgId: string): Promise<ChannelRecord[]>;
  findMany(orgId: string, ids: string[]): Promise<ChannelRecord[]>;
  updateTokens(
    id: string,
    d: {
      tokenEnc: Uint8Array;
      refreshTokenEnc?: Uint8Array;
      tokenKeyVersion: number;
      tokenExpiresAt?: Date | null;
    },
  ): Promise<void>;
  setStatus(id: string, status: ChannelStatus): Promise<void>;
  softDelete(orgId: string, id: string): Promise<boolean>;
}

export interface PublicationView {
  id: string;
  orgId: string;
  groupId: string;
  channelId: string;
  state: PublicationState;
  publishAt: Date | null;
  content: PostContent;
  settings: unknown;
  attemptCount: number;
  /** versão do agendamento: jobs antigos (edit/cancel) são descartados pelo handler */
  jobVersion: number;
  /** cursor de thread: itens <= índice já publicados — nunca republicar (SPEC_QUEUE §7) */
  lastPublishedIndex: number;
  /** total de itens da thread (1 = post simples); preenchido no getGroup */
  itemCount?: number;
  externalId: string | null;
  releaseUrl: string | null;
  errorClass: string | null;
  errorMessage: string | null;
}

/** Item de thread persistido em publication_items (position 0 = post principal). */
export interface PublicationItemView {
  id: string;
  position: number;
  content: { text: string };
  media: MediaRef[];
  /** espera ANTES de publicar este item (0 = imediato) */
  delaySec: number;
  externalId: string | null;
}

export interface TransitionPatch {
  externalId?: string;
  releaseUrl?: string;
  errorClass?: string | null;
  errorMessage?: string | null;
  publishedAt?: Date;
  incrementAttempt?: boolean;
  bumpJobVersion?: boolean;
  attemptId?: string;
}

export interface PublishingRepository {
  createGroup(d: {
    orgId: string;
    authorId: string | null;
    baseContent: PostContent;
    publishAt: Date;
    timezone: string;
    origin: PostOrigin;
    /** DRAFT = aguardando aprovação (sem job); default SCHEDULED */
    state?: 'DRAFT' | 'SCHEDULED';
    publications: Array<{
      channelId: string;
      /** content do item 0 (fonte de verdade p/ edições via PATCH) */
      content: PostContent;
      settings: unknown;
      /** thread completa (>= 1 item; item 0 duplica content) */
      items: Array<{ content: { text: string }; media: MediaRef[]; delaySec: number }>;
    }>;
  }): Promise<{ groupId: string; publications: Array<{ id: string; channelId: string }> }>;
  getGroup(
    orgId: string,
    groupId: string,
  ): Promise<{
    id: string;
    state: GroupState;
    publishAt: Date | null;
    timezone: string;
    baseContent: unknown;
    publications: PublicationView[];
  } | null>;
  findForPublish(
    publicationId: string,
  ): Promise<{ publication: PublicationView; channel: ChannelRecord } | null>;
  /** UPDATE condicional (fencing) + linha em publication_events; false se o estado não estava em `from` */
  transition(
    id: string,
    from: PublicationState[],
    to: PublicationState,
    patch?: TransitionPatch,
  ): Promise<boolean>;
  /** SCHEDULED com publish_at vencido (scanner §8) */
  listDue(before: Date, limit: number): Promise<Array<{ id: string; jobVersion: number }>>;
  /** itens da thread ordenados por position (sempre >= 1) */
  listItems(publicationId: string): Promise<PublicationItemView[]>;
  /** confirma item publicado: external_id no item + cursor na publication (monotônico);
   *  position 0 também preenche externalId/releaseUrl da publication */
  recordItemPublished(
    publicationId: string,
    itemId: string,
    position: number,
    d: { externalId: string | null; releaseUrl?: string | null },
  ): Promise<void>;
  /** edita conteúdo/horário das publicações ainda pendentes (SCHEDULED/RETRYING):
   *  volta a SCHEDULED, zera tentativas e incrementa job_version (jobs antigos morrem).
   *  baseContent é MERGE (jsonb ||): editar só o texto preserva a mídia anexada */
  rescheduleGroup(
    orgId: string,
    groupId: string,
    d: { baseContent?: Partial<PostContent>; publishAt?: Date },
  ): Promise<Array<{ id: string; channelId: string; jobVersion: number; publishAt: Date }>>;
  /** edita conteúdo/horário de um grupo ainda DRAFT (aguardando aprovação) — permanece DRAFT,
   *  sem jobs e sem bump de versão; merge de baseContent como no rescheduleGroup.
   *  false = grupo não está em DRAFT */
  updateDraftGroup(
    orgId: string,
    groupId: string,
    d: { baseContent?: Partial<PostContent>; publishAt?: Date },
  ): Promise<boolean>;
  /** aprovação: transiciona grupo + publicações DRAFT→SCHEDULED (com publication_events);
   *  [] = grupo não estava mais em DRAFT (cancelado/corrida) */
  scheduleDraftGroup(
    orgId: string,
    groupId: string,
  ): Promise<Array<{ id: string; channelId: string; jobVersion: number; publishAt: Date | null }>>;
  /** RETRYING/TOKEN_REFRESH/PUBLISHING parados há muito tempo (watchdog §8) */
  listStuck(updatedBefore: Date, limit: number): Promise<Array<{ id: string; state: PublicationState }>>;
  /** agrega estados das publicações → estado do grupo (DONE/PARTIAL/…) */
  refreshGroupState(groupId: string): Promise<void>;
}
