/** Mapeamento estado → variante do Badge (tokens --state-* — brand README §3). */
export type StateBadgeVariant =
  | 'neutral'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'review';

export const STATE_BADGE: Record<string, StateBadgeVariant> = {
  // publicações
  DRAFT: 'neutral',
  SCHEDULED: 'scheduled',
  PUBLISHING: 'publishing',
  RETRYING: 'publishing',
  TOKEN_REFRESH: 'publishing',
  PUBLISHED: 'published',
  FAILED: 'failed',
  CANCELLED: 'neutral',
  NEEDS_REVIEW: 'review',
  // grupos (agregado: SCHEDULED enquanto houver pendente; terminal = DONE/PARTIAL/CANCELLED)
  DONE: 'published',
  PARTIAL: 'review',
};

export const stateBadgeVariant = (state: string): StateBadgeVariant =>
  STATE_BADGE[state] ?? 'neutral';

/** estados de GRUPO em que ainda dá para editar/cancelar (pendentes) */
export const EDITABLE_STATES = new Set(['DRAFT', 'SCHEDULED']);
export const CANCELLABLE_STATES = new Set(['DRAFT', 'SCHEDULED']);
/** estados de PUBLICAÇÃO que aceitam retry manual */
export const RETRYABLE_STATES = new Set(['FAILED', 'NEEDS_REVIEW']);
