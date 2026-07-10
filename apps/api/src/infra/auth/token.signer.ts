import { SignJWT, jwtVerify } from 'jose';
import { MemberRoles, type MemberRole } from '@manypost/contracts';
import type { TokenSigner } from '@manypost/core';

/** JWT HS256 (access token 15min — SPEC_API_MCP §2). */
export function makeJwtSigner(secret: string): TokenSigner {
  const key = new TextEncoder().encode(secret);
  return {
    async sign(claims, ttlSec) {
      return new SignJWT({ org: claims.org, role: claims.role })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(claims.sub)
        .setIssuedAt()
        .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSec)
        .sign(key);
    },
    async verify(token) {
      try {
        const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
        if (
          typeof payload.sub !== 'string' ||
          typeof payload.org !== 'string' ||
          !MemberRoles.includes(payload.role as MemberRole)
        ) {
          return null;
        }
        return { sub: payload.sub, org: payload.org, role: payload.role as MemberRole };
      } catch {
        return null;
      }
    },
  };
}
