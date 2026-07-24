import { describe, expect, it } from 'bun:test';
import { ClerkAPIResponseError } from '@clerk/backend/errors';
import { ErrorCodes } from '@manypost/contracts';
import { makeClerkIdentityVerifier } from './clerk.identity';

const user = {
  id: 'user_clerk_1',
  firstName: 'Ada',
  lastName: 'Lovelace',
  imageUrl: 'https://img.example.test/ada.png',
  primaryEmailAddressId: 'email_1',
  emailAddresses: [
    {
      id: 'email_1',
      emailAddress: 'Ada@Example.test',
      verification: { status: 'verified' },
    },
  ],
};

describe('Clerk identity verifier', () => {
  it('verifica token e resolve somente o e-mail primário verificado', async () => {
    const calls: unknown[] = [];
    const verify = makeClerkIdentityVerifier(
      {
        secretKey: 'sk_test_example',
        authorizedParties: ['https://app.manypost.com.br'],
      },
      {
        verifyToken: async (token, options) => {
          calls.push({ token, options });
          return { sub: 'user_clerk_1' };
        },
        getUser: async (id) => {
          calls.push({ id });
          return user;
        },
      },
    );

    const verified = await verify('session-token');
    expect(verified.providerUserId).toBe('user_clerk_1');
    await expect(verified.loadProfile()).resolves.toEqual({
      provider: 'clerk',
      providerUserId: 'user_clerk_1',
      email: 'Ada@Example.test',
      emailVerified: true,
      name: 'Ada Lovelace',
      avatarUrl: 'https://img.example.test/ada.png',
    });
    expect(calls[0]).toEqual({
      token: 'session-token',
      options: {
        secretKey: 'sk_test_example',
        jwtKey: undefined,
        authorizedParties: ['https://app.manypost.com.br'],
      },
    });
  });

  it('falha fechado quando o token é inválido', async () => {
    const verify = makeClerkIdentityVerifier(
      {
        secretKey: 'sk_test_example',
        authorizedParties: ['https://app.manypost.com.br'],
      },
      {
        verifyToken: async () => {
          throw new Error('token detail must not escape');
        },
        getUser: async () => user,
      },
    );

    await expect(verify('invalid')).rejects.toMatchObject({
      code: ErrorCodes.AuthUnauthorized,
      message: 'sessão Clerk inválida',
    });
  });

  it('recusa perfil sem e-mail primário verificado', async () => {
    const verify = makeClerkIdentityVerifier(
      {
        secretKey: 'sk_test_example',
        authorizedParties: ['https://app.manypost.com.br'],
      },
      {
        verifyToken: async () => ({ sub: 'user_clerk_1' }),
        getUser: async () => ({
          ...user,
          emailAddresses: [
            {
              ...user.emailAddresses[0]!,
              verification: { status: 'unverified' },
            },
          ],
        }),
      },
    );

    await expect((await verify('session-token')).loadProfile()).rejects.toMatchObject({
      code: ErrorCodes.AuthSocialEmailUnverified,
    });
  });

  it('distingue indisponibilidade ao resolver o usuário de token inválido', async () => {
    const verify = makeClerkIdentityVerifier(
      {
        secretKey: 'sk_test_example',
        authorizedParties: ['https://app.manypost.com.br'],
      },
      {
        verifyToken: async () => ({ sub: 'user_clerk_1' }),
        getUser: async () => {
          throw new Error('network detail must not escape');
        },
      },
    );

    await expect((await verify('session-token')).loadProfile()).rejects.toMatchObject({
      code: ErrorCodes.AuthProviderUnavailable,
      message: 'Clerk temporariamente indisponível',
    });
  });

  it('não troca uma sessão Clerk com tarefa obrigatória pendente', async () => {
    const verify = makeClerkIdentityVerifier(
      {
        secretKey: 'sk_test_example',
        authorizedParties: ['https://app.manypost.com.br'],
      },
      {
        verifyToken: async () => ({ sub: 'user_clerk_1', sts: 'pending' }),
        getUser: async () => user,
      },
    );

    await expect(verify('session-token')).rejects.toMatchObject({
      code: ErrorCodes.AuthUnauthorized,
      message: 'a sessão Clerk possui tarefa obrigatória pendente',
    });
  });

  it('trata usuário Clerk inexistente como identidade inválida, não indisponibilidade', async () => {
    const verify = makeClerkIdentityVerifier(
      {
        secretKey: 'sk_test_example',
        authorizedParties: ['https://app.manypost.com.br'],
      },
      {
        verifyToken: async () => ({ sub: 'deleted_user' }),
        getUser: async () => {
          throw new ClerkAPIResponseError('not found', { status: 404, data: [] });
        },
      },
    );

    await expect((await verify('session-token')).loadProfile()).rejects.toMatchObject({
      code: ErrorCodes.AuthUnauthorized,
      message: 'identidade Clerk inválida',
    });
  });

  for (const status of [401, 403, 429, 500]) {
    it(`trata resposta ${status} da Backend API como indisponibilidade`, async () => {
      const verify = makeClerkIdentityVerifier(
        {
          secretKey: 'sk_test_example',
          authorizedParties: ['https://app.manypost.com.br'],
        },
        {
          verifyToken: async () => ({ sub: 'user_clerk_1' }),
          getUser: async () => {
            throw new ClerkAPIResponseError('backend failure', { status, data: [] });
          },
        },
      );

      await expect((await verify('session-token')).loadProfile()).rejects.toMatchObject({
        code: ErrorCodes.AuthProviderUnavailable,
        message: 'Clerk temporariamente indisponível',
      });
    });
  }
});
