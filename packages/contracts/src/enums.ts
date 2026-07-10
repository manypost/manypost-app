/**
 * Enums públicos compartilhados entre core (transições), db (pgEnum) e API (OpenAPI).
 * Fonte única — nunca duplicar estas listas.
 */

// Derived from Postiz (AGPL-3.0): enum State em schema.prisma, estendido (SPEC_QUEUE §4)
export const PublicationStates = [
  'DRAFT',
  'SCHEDULED',
  'PUBLISHING',
  'RETRYING',
  'TOKEN_REFRESH',
  'PUBLISHED',
  'FAILED',
  'CANCELLED',
  'NEEDS_REVIEW',
] as const;
export type PublicationState = (typeof PublicationStates)[number];

export const GroupStates = ['DRAFT', 'SCHEDULED', 'PARTIAL', 'DONE', 'CANCELLED'] as const;
export type GroupState = (typeof GroupStates)[number];

export const ChannelStatuses = [
  'ACTIVE',
  'PENDING_ACCOUNT_SELECTION',
  'REFRESH_REQUIRED',
  'DISABLED',
] as const;
export type ChannelStatus = (typeof ChannelStatuses)[number];

export const MemberRoles = ['OWNER', 'ADMIN', 'MEMBER'] as const;
export type MemberRole = (typeof MemberRoles)[number];

// Derived from Postiz (AGPL-3.0): enum CreationMethod, generalizado
export const PostOrigins = ['WEB', 'API', 'MCP', 'AUTOMATION'] as const;
export type PostOrigin = (typeof PostOrigins)[number];

export const ActorTypes = ['USER', 'API_KEY', 'MCP', 'SYSTEM', 'PUBLIC_LINK'] as const;
export type ActorType = (typeof ActorTypes)[number];

export const ApprovalStatuses = [
  'PENDING',
  'APPROVED',
  'CHANGES_REQUESTED',
  'EXPIRED',
  'REVOKED',
] as const;
export type ApprovalStatus = (typeof ApprovalStatuses)[number];
