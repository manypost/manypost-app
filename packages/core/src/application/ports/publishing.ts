import type {
  ChannelStatus,
  GroupState,
  PostOrigin,
  PublicationState,
} from '@manypost/contracts';

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
  content: { text: string };
  settings: unknown;
  attemptCount: number;
  /** versão do agendamento: jobs antigos (edit/cancel) são descartados pelo handler */
  jobVersion: number;
  externalId: string | null;
  releaseUrl: string | null;
  errorClass: string | null;
  errorMessage: string | null;
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
    baseContent: { text: string };
    publishAt: Date;
    timezone: string;
    origin: PostOrigin;
    publications: Array<{ channelId: string; content: { text: string }; settings: unknown }>;
  }): Promise<{ groupId: string; publications: Array<{ id: string; channelId: string }> }>;
  getGroup(
    orgId: string,
    groupId: string,
  ): Promise<{
    id: string;
    state: GroupState;
    publishAt: Date | null;
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
  /** edita conteúdo/horário das publicações ainda pendentes (SCHEDULED/RETRYING):
   *  volta a SCHEDULED, zera tentativas e incrementa job_version (jobs antigos morrem) */
  rescheduleGroup(
    orgId: string,
    groupId: string,
    d: { baseContent?: { text: string }; publishAt?: Date },
  ): Promise<Array<{ id: string; channelId: string; jobVersion: number; publishAt: Date }>>;
  /** RETRYING/TOKEN_REFRESH/PUBLISHING parados há muito tempo (watchdog §8) */
  listStuck(updatedBefore: Date, limit: number): Promise<Array<{ id: string; state: PublicationState }>>;
  /** agrega estados das publicações → estado do grupo (DONE/PARTIAL/…) */
  refreshGroupState(groupId: string): Promise<void>;
}
