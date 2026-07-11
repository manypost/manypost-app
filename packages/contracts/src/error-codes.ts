/** Codes estáveis de erro de domínio (contrato público — SPEC_BACKEND §4.2). */
export const ErrorCodes = {
  // channels
  ChannelRefreshRequired: 'channel.refresh_required',
  ChannelMissingScopes: 'channel.missing_scopes',
  ChannelDisabled: 'channel.disabled',
  // posts
  PostInvalidMedia: 'post.invalid_media',
  PostTooLong: 'post.too_long',
  PostEmptyContent: 'post.empty_content',
  PostInvalidTransition: 'post.invalid_transition',
  PostNoChannels: 'post.no_channels',
  PostInvalidSettings: 'post.invalid_settings',
  // media
  MediaUnsupportedType: 'media.unsupported_type',
  MediaTooLarge: 'media.too_large',
  MediaFetchFailed: 'media.fetch_failed',
  // plano/limites
  PlanChannelLimit: 'plan.channel_limit',
  RateLimited: 'rate.limited',
  // ia
  AiBudgetExceeded: 'ai.budget_exceeded',
  CapabilityDisabled: 'capability.disabled',
  // auth
  AuthInvalidCredentials: 'auth.invalid_credentials',
  AuthEmailTaken: 'auth.email_taken',
  AuthSessionInvalid: 'auth.session_invalid',
  AuthUnauthorized: 'auth.unauthorized',
  AuthSocialEmailUnverified: 'auth.social_email_unverified',
  // genéricos
  NotFound: 'common.not_found',
  Forbidden: 'common.forbidden',
  IdempotencyConflict: 'common.idempotency_conflict',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
