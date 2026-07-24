import { createClerkClient, verifyToken } from '@clerk/backend';
import {
  isClerkAPIResponseError,
  TokenVerificationError,
  TokenVerificationErrorReason,
} from '@clerk/backend/errors';
import { ErrorCodes } from '@manypost/contracts';
import { DomainError, type SocialProfile } from '@manypost/core';

interface ClerkIdentityOptions {
  secretKey: string;
  jwtKey?: string | undefined;
  authorizedParties: string[];
}

interface ClerkUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string;
  primaryEmailAddressId: string | null;
  emailAddresses: Array<{
    id: string;
    emailAddress: string;
    verification: { status: string } | null;
  }>;
}

interface ClerkIdentityDependencies {
  verifyToken: (
    token: string,
    options: {
      secretKey: string;
      jwtKey: string | undefined;
      authorizedParties: string[];
    },
  ) => Promise<{ sub?: string; sts?: string }>;
  getUser: (userId: string) => Promise<ClerkUser>;
}

export interface VerifiedClerkIdentity {
  providerUserId: string;
  loadProfile: () => Promise<SocialProfile>;
}

export type ClerkIdentityVerifier = (token: string) => Promise<VerifiedClerkIdentity>;

export function makeClerkIdentityVerifier(
  options: ClerkIdentityOptions,
  dependencies?: ClerkIdentityDependencies,
): ClerkIdentityVerifier {
  const client = dependencies ? null : createClerkClient({ secretKey: options.secretKey });
  const deps: ClerkIdentityDependencies = dependencies ?? {
    verifyToken: (token, verifyOptions) => verifyToken(token, verifyOptions),
    getUser: (userId) => client!.users.getUser(userId),
  };

  return async (token) => {
    let subject: string;
    try {
      const claims = await deps.verifyToken(token, {
        secretKey: options.secretKey,
        jwtKey: options.jwtKey,
        authorizedParties: options.authorizedParties,
      });
      if (!claims.sub) throw new Error('subject ausente');
      if (claims.sts === 'pending') {
        throw new DomainError(
          ErrorCodes.AuthUnauthorized,
          'a sessão Clerk possui tarefa obrigatória pendente',
        );
      }
      subject = claims.sub;
    } catch (error) {
      if (error instanceof DomainError) throw error;
      if (
        error instanceof TokenVerificationError &&
        [
          TokenVerificationErrorReason.RemoteJWKFailedToLoad,
          TokenVerificationErrorReason.RemoteJWKInvalid,
          TokenVerificationErrorReason.RemoteJWKMissing,
          TokenVerificationErrorReason.JWKFailedToResolve,
        ].includes(error.reason)
      ) {
        throw new DomainError(
          ErrorCodes.AuthProviderUnavailable,
          'Clerk temporariamente indisponível',
        );
      }
      throw new DomainError(ErrorCodes.AuthUnauthorized, 'sessão Clerk inválida');
    }

    return {
      providerUserId: subject,
      loadProfile: async () => {
        try {
          const user = await deps.getUser(subject);
          const email = user.emailAddresses.find(
            (item) => item.id === user.primaryEmailAddressId,
          );
          if (!email || email.verification?.status !== 'verified') {
            throw new DomainError(
              ErrorCodes.AuthSocialEmailUnverified,
              'a conta Clerk não possui e-mail primário verificado',
            );
          }

          const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || null;
          return {
            provider: 'clerk',
            providerUserId: user.id,
            email: email.emailAddress,
            emailVerified: true,
            name,
            avatarUrl: user.imageUrl || null,
          };
        } catch (error) {
          if (error instanceof DomainError) throw error;
          if (isClerkAPIResponseError(error) && error.status === 404) {
            throw new DomainError(ErrorCodes.AuthUnauthorized, 'identidade Clerk inválida');
          }
          throw new DomainError(
            ErrorCodes.AuthProviderUnavailable,
            'Clerk temporariamente indisponível',
          );
        }
      },
    };
  };
}
