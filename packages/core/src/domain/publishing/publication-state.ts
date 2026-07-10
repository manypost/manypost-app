// Derived from Postiz (AGPL-3.0): enum State em schema.prisma (QUEUE/PUBLISHED/ERROR/DRAFT),
// estendido conforme SPEC_QUEUE_PUBLISHING §4.
export const PublicationStates = [
  'DRAFT',
  'SCHEDULED',
  'PUBLISHING',
  'RETRYING',
  'TOKEN_REFRESH',
  'PUBLISHED',
  'FAILED',
  'CANCELLED',
  'NEEDS_REVIEW', // incerteza pós-crash: humano decide (DECISIONS v1 §7 — nunca repostar às cegas)
] as const;

export type PublicationState = (typeof PublicationStates)[number];

/** Transições permitidas — única fonte de verdade; UPDATEs condicionais no repositório (fencing). */
export const AllowedTransitions: Record<PublicationState, readonly PublicationState[]> = {
  DRAFT: ['SCHEDULED', 'CANCELLED'],
  SCHEDULED: ['PUBLISHING', 'CANCELLED'],
  PUBLISHING: ['PUBLISHED', 'RETRYING', 'TOKEN_REFRESH', 'FAILED', 'NEEDS_REVIEW'],
  RETRYING: ['PUBLISHING', 'FAILED', 'CANCELLED'],
  TOKEN_REFRESH: ['PUBLISHING', 'FAILED'],
  PUBLISHED: [],
  FAILED: ['SCHEDULED'], // retry manual
  CANCELLED: [],
  NEEDS_REVIEW: ['PUBLISHED', 'SCHEDULED', 'FAILED'], // resolução humana
};

export function canTransition(from: PublicationState, to: PublicationState): boolean {
  return AllowedTransitions[from].includes(to);
}
