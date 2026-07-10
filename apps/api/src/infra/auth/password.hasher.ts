import type { PasswordHasher } from '@manypost/core';

/** Argon2id nativo do Bun (custos default seguros; SPEC_DATA §3 identity). */
export const bunPasswordHasher: PasswordHasher = {
  hash: (plain) => Bun.password.hash(plain, { algorithm: 'argon2id' }),
  verify: (plain, hash) => Bun.password.verify(plain, hash),
};
