import { sql } from 'drizzle-orm';
import type { AiCreditsRepository } from '@manypost/core';
import type { Db } from '../index';
import { uuidv7 } from '../uuid';

/**
 * Franquia de IA: reserva de duas fases sobre `ai_credits` + `ai_grants` (SPEC_AI §4).
 *
 * Três coisas acontecem antes de qualquer chamada ao modelo, na MESMA transação:
 *   1. o balde do período é aberto se faltar (idempotente pelo índice único org/kind/período);
 *   2. reservas com lease vencida da org voltam à franquia (varredura preguiçosa, sem cron —
 *      mesmo precedente do link de aprovação);
 *   3. a reserva é concedida por um UPDATE condicional `granted - used - reserved >= n`.
 *
 * O passo 3 é o que torna impossível furar a franquia: o UPDATE bloqueia a linha, então dez
 * gerações simultâneas se enfileiram nela e a aritmética nunca vê estado intermediário.
 */
/**
 * O mínimo que os passos abaixo precisam: `db` e uma transação satisfazem os dois. Tipar pelo
 * uso evita o cast largo `tx`, que mentiria (uma transação não é um pool).
 */
type Executor = Pick<Db, 'execute'>;

export function makeAiCreditsRepository(db: Db): AiCreditsRepository {
  /**
   * Abre (ou atualiza) o balde do período e devolve seu id.
   *
   * `granted` sobe para o maior valor entre o gravado e o do plano atual: um upgrade no meio do
   * mês libera a franquia maior na hora. Nunca desce — retirar franquia já disponível puniria
   * quem trocou de plano, e abaixo de `used + reserved` seria incoerente de qualquer forma.
   */
  const ensureBucket = async (
    tx: Executor,
    orgId: string,
    granted: number,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<string> => {
    const rows = await tx.execute<{ id: string }>(sql`
      INSERT INTO ai_credits (id, org_id, kind, granted, used, reserved, period_start, period_end)
      VALUES (${uuidv7()}::uuid, ${orgId}::uuid, 'general', ${granted}::int, 0, 0,
              ${periodStart.toISOString()}::timestamptz, ${periodEnd.toISOString()}::timestamptz)
      ON CONFLICT (org_id, kind, period_start) DO UPDATE
        SET granted = GREATEST(ai_credits.granted, excluded.granted),
            updated_at = now()
      RETURNING id
    `);
    return rows[0]!.id;
  };

  /** devolve à franquia toda reserva da org cuja lease venceu sem desfecho */
  const reclaimExpired = async (tx: Executor, orgId: string): Promise<void> => {
    await tx.execute(sql`
      WITH vencidas AS (
        UPDATE ai_grants
           SET state = 'RELEASED', updated_at = now()
         WHERE org_id = ${orgId}::uuid
           AND state = 'RESERVED'
           AND expires_at < now()
        RETURNING credit_id, estimated_credits
      ), total AS (
        SELECT credit_id, SUM(estimated_credits)::int AS creditos
          FROM vencidas GROUP BY credit_id
      )
      UPDATE ai_credits c
         SET reserved = GREATEST(0, c.reserved - t.creditos), updated_at = now()
        FROM total t
       WHERE c.id = t.credit_id
    `);
  };

  return {
    async reserve({ orgId, operation, credits, granted, periodStart, periodEnd, leaseSec }) {
      return db.transaction(async (tx) => {
        const creditId = await ensureBucket(tx, orgId, granted, periodStart, periodEnd);
        await reclaimExpired(tx, orgId);

        // UMA instrução decide: sem franquia, zero linhas — e nada foi reservado
        const reservado = await tx.execute<{ id: string }>(sql`
          UPDATE ai_credits
             SET reserved = reserved + ${credits}::int, updated_at = now()
           WHERE id = ${creditId}::uuid
             AND granted - used - reserved >= ${credits}::int
          RETURNING id
        `);
        if (!reservado[0]) return null;

        const grantId = uuidv7();
        await tx.execute(sql`
          INSERT INTO ai_grants
            (id, org_id, credit_id, operation, estimated_credits, state, expires_at)
          VALUES (${grantId}::uuid, ${orgId}::uuid, ${creditId}::uuid, ${operation}::text,
                  ${credits}::int, 'RESERVED',
                  now() + (${leaseSec}::int * interval '1 second'))
        `);
        return { grantId };
      });
    },

    async commit(grantId, actual) {
      await db.transaction(async (tx) => {
        // sair de RESERVED é a condição: repetir a confirmação, ou confirmar uma reserva que a
        // lease já recuperou, não encontra linha e não debita nada
        const rows = await tx.execute<{ credit_id: string; estimated_credits: number }>(sql`
          UPDATE ai_grants
             SET state = 'COMMITTED',
                 credits = ${actual.credits}::int,
                 input_tokens = ${actual.inputTokens ?? null},
                 output_tokens = ${actual.outputTokens ?? null},
                 updated_at = now()
           WHERE id = ${grantId}::uuid AND state = 'RESERVED'
          RETURNING credit_id, estimated_credits
        `);
        const grant = rows[0];
        if (!grant) return;

        // o consumo real entra em `used`; a reserva sai de `reserved` pelo valor ESTIMADO,
        // que foi exatamente o que ela somou lá
        await tx.execute(sql`
          UPDATE ai_credits
             SET used = used + ${actual.credits}::int,
                 reserved = GREATEST(0, reserved - ${grant.estimated_credits}::int),
                 updated_at = now()
           WHERE id = ${grant.credit_id}::uuid
        `);
      });
    },

    async release(grantId) {
      await db.transaction(async (tx) => {
        const rows = await tx.execute<{ credit_id: string; estimated_credits: number }>(sql`
          UPDATE ai_grants
             SET state = 'RELEASED', updated_at = now()
           WHERE id = ${grantId}::uuid AND state = 'RESERVED'
          RETURNING credit_id, estimated_credits
        `);
        const grant = rows[0];
        if (!grant) return;

        await tx.execute(sql`
          UPDATE ai_credits
             SET reserved = GREATEST(0, reserved - ${grant.estimated_credits}::int),
                 updated_at = now()
           WHERE id = ${grant.credit_id}::uuid
        `);
      });
    },

    async balance({ orgId, granted, periodStart, periodEnd }) {
      return db.transaction(async (tx) => {
        const creditId = await ensureBucket(tx, orgId, granted, periodStart, periodEnd);
        // ler o saldo é o momento natural de limpar lease vencida: sem isso o `/v1/capabilities`
        // mostraria como reservado algo que nenhuma geração está usando
        await reclaimExpired(tx, orgId);

        const rows = await tx.execute<{
          granted: number;
          used: number;
          reserved: number;
          period_end: string;
        }>(sql`
          SELECT granted, used, reserved, period_end FROM ai_credits WHERE id = ${creditId}::uuid
        `);
        const row = rows[0]!;
        return {
          granted: Number(row.granted),
          used: Number(row.used),
          reserved: Number(row.reserved),
          periodEnd: new Date(row.period_end),
        };
      });
    },
  };
}
