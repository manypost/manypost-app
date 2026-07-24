import postgres from 'postgres';

interface E2EHuman {
  auth: {
    authorization: string;
    'content-type': string;
  };
  email: string;
  orgId: string;
  userId: string;
}

const encode = (value: string | Uint8Array) => {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return Buffer.from(bytes).toString('base64url');
};

const privateKey = async () => {
  const path = process.env.E2E_CLERK_PRIVATE_KEY_FILE;
  if (!path) throw new Error('E2E_CLERK_PRIVATE_KEY_FILE ausente');
  const pem = await Bun.file(path).text();
  const der = Buffer.from(
    pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, ''),
    'base64',
  );
  return crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
};

async function signSession(subject: string, authorizedParty: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = encode(JSON.stringify({ alg: 'RS256', kid: 'manypost-e2e', typ: 'JWT' }));
  const payload = encode(
    JSON.stringify({
      sub: subject,
      azp: authorizedParty,
      iat: now,
      nbf: now - 1,
      exp: now + 15 * 60,
    }),
  );
  const input = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    await privateKey(),
    new TextEncoder().encode(input),
  );
  return `${input}.${encode(new Uint8Array(signature))}`;
}

export async function createE2EHuman(
  label: string,
  authorizedParty = process.env.BASE_URL ?? process.env.PUBLIC_URL,
): Promise<E2EHuman> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL ausente');
  if (!authorizedParty) throw new Error('origem autorizada E2E ausente');

  const suffix = `${label}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const subject = `user_e2e_${suffix}`;
  const email = `${suffix}@test.dev`;
  const userId = crypto.randomUUID();
  const orgId = crypto.randomUUID();
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });

  try {
    await sql.begin(async (tx) => {
      await tx`
        insert into users (id, email, password_hash, name)
        values (${userId}, ${email}, null, ${`E2E ${label}`})
      `;
      await tx`
        insert into organizations (id, name, slug)
        values (${orgId}, ${`E2E ${label}`}, ${suffix})
      `;
      await tx`
        insert into memberships (id, org_id, user_id, role)
        values (${crypto.randomUUID()}, ${orgId}, ${userId}, 'OWNER')
      `;
      await tx`
        insert into auth_identities (
          id, user_id, provider, provider_user_id, email
        )
        values (
          ${crypto.randomUUID()}, ${userId}, 'clerk', ${subject}, ${email}
        )
      `;
    });
  } finally {
    await sql.end();
  }

  const token = await signSession(subject, new URL(authorizedParty).origin);
  return {
    auth: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    email,
    orgId,
    userId,
  };
}
