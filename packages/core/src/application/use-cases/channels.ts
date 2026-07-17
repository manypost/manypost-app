import type {
  ChannelProvider,
  ConnectedToken,
  ExternalAccount,
  ProviderContext,
  TokenSet,
} from '@manypost/contracts';
import { ErrorCodes } from '@manypost/contracts';
import { DomainError } from '../../domain/shared/result';
import type { CryptoService } from '../ports/crypto';
import type { ChannelRecord, ChannelRepository } from '../ports/publishing';

/** AAD estável por chave natural (id do canal só existe após o insert). */
export const channelAad = (orgId: string, provider: string, externalId: string) =>
  `${orgId}:${provider}:${externalId}`;

/** Campos seguros para superfícies (nunca tokens). */
export function sanitizeChannel(c: ChannelRecord) {
  return {
    id: c.id,
    provider: c.provider,
    externalId: c.externalId,
    name: c.name,
    username: c.username,
    avatarUrl: c.avatarUrl,
    status: c.status,
    scopes: c.scopes,
  };
}

export interface ChannelDeps {
  channels: ChannelRepository;
  crypto: CryptoService;
}

export const makeConnectChannel = (deps: ChannelDeps) =>
  async (input: {
    orgId: string;
    provider: ChannelProvider;
    account: TokenSet & ExternalAccount & { channelSettings?: Record<string, unknown> };
  }) => {
    const { orgId, provider, account } = input;
    const aad = channelAad(orgId, provider.id, account.externalId);
    const token = await deps.crypto.encrypt(account.accessToken, aad);
    const refresh = account.refreshToken
      ? await deps.crypto.encrypt(account.refreshToken, aad)
      : null;

    const record = await deps.channels.upsert({
      orgId,
      provider: provider.id,
      externalId: account.externalId,
      name: account.name,
      username: account.username ?? null,
      avatarUrl: account.avatarUrl ?? null,
      scopes: account.scopes,
      settings: account.channelSettings ?? {},
      tokenEnc: token.ciphertext,
      refreshTokenEnc: refresh?.ciphertext ?? null,
      tokenKeyVersion: token.keyVersion,
      tokenExpiresAt: account.expiresAt ? new Date(account.expiresAt) : null,
      status: 'ACTIVE',
    });
    return sanitizeChannel(record);
  };

export const makeListChannels = (deps: Pick<ChannelDeps, 'channels'>) =>
  async (orgId: string) => (await deps.channels.list(orgId)).map(sanitizeChannel);

export const makeDisconnectChannel = (deps: Pick<ChannelDeps, 'channels'>) =>
  async (orgId: string, id: string) => {
    const ok = await deps.channels.softDelete(orgId, id);
    if (!ok) throw new DomainError(ErrorCodes.NotFound, 'canal não encontrado');
  };

export const makeListSubAccounts = (deps: ChannelDeps) =>
  async (orgId: string, channelId: string, provider: ChannelProvider, ctx: ProviderContext) => {
    const list = await deps.channels.list(orgId);
    const row = list.find((c) => c.id === channelId);
    if (!row) throw new DomainError(ErrorCodes.NotFound, 'canal não encontrado');
    if (!provider.listSubAccounts) return [];

    const aad = channelAad(orgId, row.provider, row.externalId);
    const accessToken = await deps.crypto.decrypt(row.tokenEnc, aad, row.tokenKeyVersion);
    const refreshToken = row.refreshTokenEnc ? await deps.crypto.decrypt(row.refreshTokenEnc, aad, row.tokenKeyVersion) : undefined;
    const token: ConnectedToken = {
      accessToken,
      ...(refreshToken ? { refreshToken } : {}),
      externalId: row.externalId,
      name: row.name ?? '',
      scopes: row.scopes,
      channelSettings: (row.settings as Record<string, unknown>) ?? {},
    };
    return provider.listSubAccounts(ctx, token);
  };
