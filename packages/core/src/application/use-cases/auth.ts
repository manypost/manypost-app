import { ErrorCodes } from '@manypost/contracts';
import { DomainError } from '../../domain/shared/result';
import type { PlanPolicy } from '../ports/plan-policy';
import type {
  ApiKeyRepository,
  AuthIdentityRepository,
  OrganizationRepository,
  UserRepository,
} from '../ports/repositories';
import { randomToken, sha256Hex } from '../tokens';

export const API_KEY_PREFIX = 'mp_live_';

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'org';

/** Identidade humana autenticada e resolvida pelo adapter Clerk. */
export interface SocialProfile {
  provider: 'clerk';
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  avatarUrl: string | null;
}

interface IdentityPrincipalDeps {
  users: UserRepository;
  orgs: OrganizationRepository;
  identities: AuthIdentityRepository;
}

export const makeResolveIdentityPrincipal = (deps: IdentityPrincipalDeps) =>
  async (input: {
    providerUserId: string;
    loadProfile: () => Promise<SocialProfile>;
  }) => {
    const existing = await deps.identities.find('clerk', input.providerUserId);
    let userId: string;
    let isNewUser = false;
    let loadedProfile: SocialProfile | null = null;

    if (existing) {
      userId = existing.userId;
    } else {
      const profile = await input.loadProfile();
      loadedProfile = profile;
      if (profile.provider !== 'clerk' || profile.providerUserId !== input.providerUserId) {
        throw new DomainError(ErrorCodes.AuthUnauthorized, 'identidade Clerk inconsistente');
      }
      if (!profile.email || !profile.emailVerified) {
        throw new DomainError(
          ErrorCodes.AuthSocialEmailUnverified,
          'a conta Clerk não possui e-mail primário verificado',
        );
      }
      const email = normalizeEmail(profile.email);
      const orgName = profile.name?.trim() || email.split('@')[0]!;
      const resolved = await deps.identities.resolveOrProvision({
        provider: profile.provider,
        providerUserId: profile.providerUserId,
        email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        orgName,
        orgSlug: `${slugify(orgName)}-${randomToken(4).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6)}`,
      });
      userId = resolved.userId;
      isNewUser = resolved.isNewUser;
    }

    if (loadedProfile?.avatarUrl) {
      await deps.users.updateAvatarIfEmpty(userId, loadedProfile.avatarUrl);
    }

    const memberships = await deps.orgs.listForUser(userId);
    const org = memberships[0];
    if (!org) {
      throw new DomainError(ErrorCodes.Forbidden, 'usuário sem organização Manypost');
    }
    const user = await deps.users.findById(userId);
    if (!user) {
      throw new DomainError(ErrorCodes.AuthUnauthorized, 'identidade interna não encontrada');
    }
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      org,
      isNewUser,
    };
  };

export interface ApiKeyDeps {
  apiKeys: ApiKeyRepository;
  /** limites comerciais do gerenciado; ausente = self-hosted (nada é barrado) */
  plan?: PlanPolicy;
}

export const makeCreateApiKey = (deps: ApiKeyDeps) =>
  async (input: { orgId: string; name: string; scopes: string[] }) => {
    await deps.plan?.assert(input.orgId, { kind: 'apiKey', scopes: input.scopes });
    const secret = randomToken(32);
    const plainKey = `${API_KEY_PREFIX}${secret}`;
    const record = await deps.apiKeys.create({
      orgId: input.orgId,
      name: input.name,
      keyHash: sha256Hex(plainKey),
      prefix: secret.slice(0, 8),
      scopes: input.scopes,
    });
    return { apiKey: plainKey, record };
  };

export const makeVerifyApiKey = (deps: ApiKeyDeps) =>
  async (presented: string) => {
    if (!presented.startsWith(API_KEY_PREFIX)) return null;
    const record = await deps.apiKeys.findActiveByHash(sha256Hex(presented));
    if (!record) return null;
    void deps.apiKeys.touchLastUsed(record.id).catch(() => {});
    return {
      orgId: record.orgId,
      scopes: record.scopes,
      apiKeyId: record.id,
    };
  };

export const makeListApiKeys = (deps: ApiKeyDeps) =>
  (orgId: string) => deps.apiKeys.list(orgId);

export const makeRevokeApiKey = (deps: ApiKeyDeps) =>
  async (input: { orgId: string; id: string }) => {
    const done = await deps.apiKeys.revoke(input.orgId, input.id);
    if (!done) {
      throw new DomainError(ErrorCodes.NotFound, 'API key não encontrada');
    }
  };
