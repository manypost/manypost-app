import { ErrorCodes } from '@manypost/contracts';
import { DomainError } from '../../domain/shared/result';
import type { PasswordHasher, TokenSigner } from '../ports/auth';
import type {
  ApiKeyRepository,
  AuthIdentityRepository,
  OrganizationRepository,
  SessionRepository,
  UserRepository,
} from '../ports/repositories';
import { randomToken, sha256Hex } from '../tokens';

export const ACCESS_TTL_SEC = 15 * 60;
export const REFRESH_TTL_SEC = 30 * 24 * 60 * 60;
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

export interface AuthDeps {
  users: UserRepository;
  orgs: OrganizationRepository;
  sessions: SessionRepository;
  hasher: PasswordHasher;
  signer: TokenSigner;
  now?: () => Date;
}

async function issueTokens(
  deps: AuthDeps,
  userId: string,
  meta: { userAgent?: string | undefined; ip?: string | undefined },
) {
  const memberships = await deps.orgs.listForUser(userId);
  const active = memberships[0];
  if (!active) throw new DomainError(ErrorCodes.AuthSessionInvalid, 'usuário sem organização');

  const refreshToken = randomToken();
  const now = (deps.now ?? (() => new Date()))();
  await deps.sessions.create({
    userId,
    refreshTokenHash: sha256Hex(refreshToken),
    expiresAt: new Date(now.getTime() + REFRESH_TTL_SEC * 1000),
    userAgent: meta.userAgent,
    ip: meta.ip,
  });
  const accessToken = await deps.signer.sign(
    { sub: userId, org: active.id, role: active.role },
    ACCESS_TTL_SEC,
  );
  return { accessToken, refreshToken, org: active };
}

export const makeRegister = (deps: AuthDeps) =>
  async (input: {
    email: string;
    password: string;
    name: string;
    orgName?: string | undefined;
    userAgent?: string | undefined;
    ip?: string | undefined;
  }) => {
    const email = normalizeEmail(input.email);
    if (await deps.users.findByEmail(email)) {
      throw new DomainError(ErrorCodes.AuthEmailTaken, 'e-mail já cadastrado');
    }
    const user = await deps.users.create({
      email,
      passwordHash: await deps.hasher.hash(input.password),
      name: input.name,
    });
    const orgName = input.orgName?.trim() || input.name;
    await deps.orgs.createWithOwner({
      name: orgName,
      slug: `${slugify(orgName)}-${randomToken(4).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6)}`,
      ownerId: user.id,
    });
    const tokens = await issueTokens(deps, user.id, input);
    return {
      user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl },
      ...tokens,
    };
  };

export const makeLogin = (deps: AuthDeps) =>
  async (input: {
    email: string;
    password: string;
    userAgent?: string | undefined;
    ip?: string | undefined;
  }) => {
    const user = await deps.users.findByEmail(normalizeEmail(input.email));
    // mesma mensagem para usuário inexistente e senha errada (não vazar existência)
    const ok = user?.passwordHash
      ? await deps.hasher.verify(input.password, user.passwordHash)
      : false;
    if (!user || !ok) {
      throw new DomainError(ErrorCodes.AuthInvalidCredentials, 'credenciais inválidas');
    }
    const tokens = await issueTokens(deps, user.id, input);
    return {
      user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl },
      ...tokens,
    };
  };

export const makeRefreshSession = (deps: AuthDeps) =>
  async (input: { refreshToken: string }) => {
    const now = (deps.now ?? (() => new Date()))();
    const found = await deps.sessions.findByTokenHash(sha256Hex(input.refreshToken));
    if (!found) throw new DomainError(ErrorCodes.AuthSessionInvalid, 'sessão inválida');

    const { session, matched } = found;
    if (session.revokedAt || session.expiresAt <= now) {
      throw new DomainError(ErrorCodes.AuthSessionInvalid, 'sessão inválida');
    }
    if (matched === 'previous') {
      // token antigo reapresentado = provável roubo → mata a sessão inteira
      await deps.sessions.revoke(session.id);
      throw new DomainError(ErrorCodes.AuthSessionInvalid, 'sessão inválida');
    }

    const newRefresh = randomToken();
    await deps.sessions.rotate(session.id, sha256Hex(newRefresh));

    const memberships = await deps.orgs.listForUser(session.userId);
    const active = memberships[0];
    if (!active) throw new DomainError(ErrorCodes.AuthSessionInvalid, 'sessão inválida');
    const accessToken = await deps.signer.sign(
      { sub: session.userId, org: active.id, role: active.role },
      ACCESS_TTL_SEC,
    );
    return { accessToken, refreshToken: newRefresh };
  };

/** Perfil resolvido pelo adapter do provedor de identidade (Google/GitHub…). */
export interface SocialProfile {
  provider: string;
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  avatarUrl: string | null;
}

export const makeLoginWithIdentity = (deps: AuthDeps & { identities: AuthIdentityRepository }) =>
  async (input: {
    profile: SocialProfile;
    userAgent?: string | undefined;
    ip?: string | undefined;
  }) => {
    const { profile } = input;
    const existing = await deps.identities.find(profile.provider, profile.providerUserId);
    let userId: string;
    let isNewUser = false;

    if (existing) {
      userId = existing.userId;
    } else {
      // vincular/criar conta por e-mail exige e-mail VERIFICADO no provedor
      if (!profile.email || !profile.emailVerified) {
        throw new DomainError(
          ErrorCodes.AuthSocialEmailUnverified,
          'o e-mail da conta social não é verificado — use e-mail e senha',
        );
      }
      const email = normalizeEmail(profile.email);
      const byEmail = await deps.users.findByEmail(email);
      if (byEmail) {
        // conta já existe (senha ou outro social) → vincula; a senha continua valendo
        userId = byEmail.id;
      } else {
        const orgName = profile.name?.trim() || email.split('@')[0]!;
        const user = await deps.users.create({
          email,
          passwordHash: null,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
        });
        await deps.orgs.createWithOwner({
          name: orgName,
          slug: `${slugify(orgName)}-${randomToken(4).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6)}`,
          ownerId: user.id,
        });
        userId = user.id;
        isNewUser = true;
      }
      await deps.identities.link({
        userId,
        provider: profile.provider,
        providerUserId: profile.providerUserId,
        email,
      });
    }

    // foto do social só preenche quando o usuário ainda não tem foto própria
    if (profile.avatarUrl) {
      await deps.users.updateAvatarIfEmpty(userId, profile.avatarUrl);
    }

    const tokens = await issueTokens(deps, userId, input);
    const user = (await deps.users.findById(userId))!;
    return {
      user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl },
      isNewUser,
      ...tokens,
    };
  };

export const makeLogout = (deps: Pick<AuthDeps, 'sessions'>) =>
  async (input: { refreshToken: string }) => {
    const found = await deps.sessions.findByTokenHash(sha256Hex(input.refreshToken));
    if (found) await deps.sessions.revoke(found.session.id);
  };

// ---------- API keys ----------

export interface ApiKeyDeps {
  apiKeys: ApiKeyRepository;
}

export const makeCreateApiKey = (deps: ApiKeyDeps) =>
  async (input: { orgId: string; name: string; scopes: string[] }) => {
    const secret = randomToken(32);
    const plainKey = `${API_KEY_PREFIX}${secret}`;
    const record = await deps.apiKeys.create({
      orgId: input.orgId,
      name: input.name,
      keyHash: sha256Hex(plainKey),
      prefix: secret.slice(0, 8),
      scopes: input.scopes,
    });
    // a chave em claro só existe nesta resposta
    return { apiKey: plainKey, record };
  };

export const makeVerifyApiKey = (deps: ApiKeyDeps) =>
  async (presented: string) => {
    if (!presented.startsWith(API_KEY_PREFIX)) return null;
    const record = await deps.apiKeys.findActiveByHash(sha256Hex(presented));
    if (!record) return null;
    void deps.apiKeys.touchLastUsed(record.id).catch(() => {});
    return { orgId: record.orgId, scopes: record.scopes, apiKeyId: record.id };
  };

export const makeListApiKeys = (deps: ApiKeyDeps) =>
  (orgId: string) => deps.apiKeys.list(orgId);

export const makeRevokeApiKey = (deps: ApiKeyDeps) =>
  async (input: { orgId: string; id: string }) => {
    const done = await deps.apiKeys.revoke(input.orgId, input.id);
    if (!done) throw new DomainError(ErrorCodes.NotFound, 'API key não encontrada');
  };
