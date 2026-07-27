import { afterAll, describe, expect, test } from 'bun:test';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../schema';
import { makeAiCreditsRepository } from './ai-credits.repo';

/**
 * A franquia de IA é decidida por um UPDATE condicional (`granted - used - reserved >= n`), e é
 * o bloqueio de linha do Postgres — não código de aplicação — que impede duas gerações
 * simultâneas de furá-la. Um dublê em memória não prova isso: ele executaria em série por
 * construção. Daí este arquivo ser integração, como o `publishing.repo`.
 *
 * Critério de aceite coberto aqui: SPEC_AI §5.3 ("concorrência de 10 gerações simultâneas não
 * fura a franquia").
 */
const databaseUrl = process.env.TEST_DATABASE_URL;
const pgTest = databaseUrl ? test : test.skip;
const client = databaseUrl ? postgres(databaseUrl, { max: 12, onnotice: () => {} }) : null;
const db = client ? drizzle(client, { schema }) : null;

afterAll(async () => {
  await client?.end();
});

const PERIODO = {
  periodStart: new Date(Date.UTC(2026, 6, 1)),
  periodEnd: new Date(Date.UTC(2026, 7, 1)),
};

async function seedOrg(suffix: string): Promise<string> {
  const [org] = await client!<{ id: string }[]>`
    INSERT INTO organizations (id, name, slug)
    VALUES (gen_random_uuid(), ${`IA ${suffix}`}, ${`ia-${suffix}`})
    RETURNING id`;
  return org!.id;
}

const saldo = async (orgId: string) =>
  (
    await client!<{ granted: number; used: number; reserved: number }[]>`
      SELECT granted, used, reserved FROM ai_credits WHERE org_id = ${orgId}::uuid`
  )[0]!;

const reservar = (orgId: string, granted: number, credits = 1, leaseSec = 120) =>
  makeAiCreditsRepository(db!).reserve({
    orgId,
    operation: 'ai.caption',
    credits,
    granted,
    leaseSec,
    ...PERIODO,
  });

describe('franquia de IA com PostgreSQL real', () => {
  pgTest('abre o balde do período na primeira reserva, com a franquia do plano', async () => {
    const orgId = await seedOrg(`${Date.now()}-a`);
    const grant = await reservar(orgId, 10);

    expect(grant).not.toBeNull();
    expect(await saldo(orgId)).toMatchObject({ granted: 10, used: 0, reserved: 1 });
  });

  // O TESTE que a SPEC_AI §5.3 exige: dez ao mesmo tempo, franquia para cinco.
  pgTest('dez reservas simultâneas contra franquia de cinco concedem exatamente cinco', async () => {
    const orgId = await seedOrg(`${Date.now()}-b`);

    const resultados = await Promise.all(
      Array.from({ length: 10 }, () => reservar(orgId, 5)),
    );

    const concedidas = resultados.filter((r) => r !== null);
    const recusadas = resultados.filter((r) => r === null);
    expect(concedidas).toHaveLength(5);
    expect(recusadas).toHaveLength(5);

    const s = await saldo(orgId);
    expect(s.reserved).toBe(5);
    // a invariante, dita como invariante: nunca se promete mais do que se concedeu
    expect(s.used + s.reserved).toBeLessThanOrEqual(s.granted);

    // e cada concessão virou exatamente uma linha de grant reservada
    const contagem = await client!<{ count: string }[]>`
      SELECT COUNT(*)::text AS count FROM ai_grants
       WHERE org_id = ${orgId}::uuid AND state = 'RESERVED'`;
    expect(Number(contagem[0]!.count)).toBe(5);
  });

  pgTest('confirmar move de reservado para usado — e confirmar de novo não debita duas vezes', async () => {
    const orgId = await seedOrg(`${Date.now()}-c`);
    const repo = makeAiCreditsRepository(db!);
    const grant = (await reservar(orgId, 10))!;

    await repo.commit(grant.grantId, { credits: 1, inputTokens: 100, outputTokens: 20 });
    expect(await saldo(orgId)).toMatchObject({ used: 1, reserved: 0 });

    await repo.commit(grant.grantId, { credits: 1 });
    expect(await saldo(orgId)).toMatchObject({ used: 1, reserved: 0 });

    const [linha] = await client!<{ state: string; input_tokens: number }[]>`
      SELECT state, input_tokens FROM ai_grants WHERE id = ${grant.grantId}::uuid`;
    expect(linha).toMatchObject({ state: 'COMMITTED', input_tokens: 100 });
  });

  pgTest('liberar devolve a reserva à franquia, e liberar de novo não credita a mais', async () => {
    const orgId = await seedOrg(`${Date.now()}-d`);
    const repo = makeAiCreditsRepository(db!);
    const grant = (await reservar(orgId, 10))!;

    await repo.release(grant.grantId);
    expect(await saldo(orgId)).toMatchObject({ used: 0, reserved: 0 });

    await repo.release(grant.grantId);
    expect(await saldo(orgId)).toMatchObject({ used: 0, reserved: 0 });
  });

  pgTest('reserva com lease vencida é recuperada pela próxima reserva da org', async () => {
    const orgId = await seedOrg(`${Date.now()}-e`);
    // franquia de 1 e lease já vencida: a segunda reserva só cabe se a primeira for recuperada
    const primeira = (await reservar(orgId, 1, 1, -60))!;
    expect(await saldo(orgId)).toMatchObject({ reserved: 1 });

    const segunda = await reservar(orgId, 1);
    expect(segunda).not.toBeNull();
    expect(await saldo(orgId)).toMatchObject({ used: 0, reserved: 1 });

    const [antiga] = await client!<{ state: string }[]>`
      SELECT state FROM ai_grants WHERE id = ${primeira.grantId}::uuid`;
    expect(antiga!.state).toBe('RELEASED');
  });

  pgTest('confirmação tardia de reserva já recuperada não consome franquia de novo', async () => {
    const orgId = await seedOrg(`${Date.now()}-f`);
    const repo = makeAiCreditsRepository(db!);
    const orfa = (await reservar(orgId, 5, 1, -60))!;

    await reservar(orgId, 5); // dispara a varredura que recupera a órfã
    const antes = await saldo(orgId);

    await repo.commit(orfa.grantId, { credits: 1 });

    expect(await saldo(orgId)).toEqual(antes); // a confirmação tardia é um no-op
  });

  pgTest('a recuperação de lease é escopada por organização', async () => {
    const stamp = Date.now();
    const orgA = await seedOrg(`${stamp}-g`);
    const orgB = await seedOrg(`${stamp}-h`);

    await reservar(orgA, 5, 1, -60); // vencida, mas de OUTRA org
    await reservar(orgB, 5); // esta reserva não pode limpar a franquia da org A

    expect(await saldo(orgA)).toMatchObject({ reserved: 1 });
  });

  pgTest('upgrade no meio do período libera a franquia maior na hora, sem abrir balde novo', async () => {
    const orgId = await seedOrg(`${Date.now()}-i`);
    await reservar(orgId, 2);
    await reservar(orgId, 2);
    expect(await reservar(orgId, 2)).toBeNull(); // franquia de 2 esgotada

    const aposUpgrade = await reservar(orgId, 10);
    expect(aposUpgrade).not.toBeNull();

    const contagem = await client!<{ count: string }[]>`
      SELECT COUNT(*)::text AS count FROM ai_credits WHERE org_id = ${orgId}::uuid`;
    expect(Number(contagem[0]!.count)).toBe(1); // um balde por período, não um por chamada
    expect(await saldo(orgId)).toMatchObject({ granted: 10, reserved: 3 });
  });

  pgTest('plano sem franquia nenhuma nunca concede', async () => {
    const orgId = await seedOrg(`${Date.now()}-j`);
    expect(await reservar(orgId, 0)).toBeNull();
    expect(await saldo(orgId)).toMatchObject({ granted: 0, reserved: 0 });
  });

  pgTest('o saldo lido reflete reservas em voo e não guarda conteúdo', async () => {
    const orgId = await seedOrg(`${Date.now()}-k`);
    const repo = makeAiCreditsRepository(db!);
    await reservar(orgId, 7);

    const balance = await repo.balance({ orgId, granted: 7, ...PERIODO });
    expect(balance).toMatchObject({ granted: 7, used: 0, reserved: 1 });
    expect(balance.periodEnd.toISOString()).toBe(PERIODO.periodEnd.toISOString());

    // nenhuma coluna de ai_grants carrega prompt ou texto gerado
    const colunas = await client!<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'ai_grants'`;
    const nomes = colunas.map((c) => c.column_name);
    expect(nomes).not.toContain('prompt');
    expect(nomes).not.toContain('content');
    expect(nomes).not.toContain('output');
  });
});
