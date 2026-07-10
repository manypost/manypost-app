import type { MemberRole } from '@manypost/contracts';

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(plain: string, hash: string): Promise<boolean>;
}

export interface AccessClaims {
  sub: string; // userId
  org: string; // organizationId ativa
  role: MemberRole;
}

export interface TokenSigner {
  sign(claims: AccessClaims, ttlSec: number): Promise<string>;
  /** null para token inválido/expirado — nunca lança */
  verify(token: string): Promise<AccessClaims | null>;
}
