import { ErrorCodes, PLANS } from '@manypost/contracts';
import { DomainError } from '../../domain/shared/result';
import type { AiBalance, BudgetGuard, TokenUsage } from '../ports/ai-provider';
import type { AiCreditsRepository } from '../ports/ai-credits';
import type { PlanPolicy } from '../ports/plan-policy';

/**
 * BudgetGuard (DECISIONS v1 §8 / SPEC_AI §4) — teto de custo como requisito de ARQUITETURA.
 *
 * O mecanismo existe em TODA instalação; só os números são impostas no gerenciado. Em
 * self-hosted (`enforced: false`) a reserva sempre passa e o consumo continua sendo registrado,
 * porque o operador que paga a própria chave também quer saber quanto gastou.
 *
 * Nunca degrada silenciosamente para um modelo mais barato: estourar recusa com
 * `ai.budget_exceeded` e diz quando a franquia renova.
 */

/** Janela da franquia: mês-calendário UTC, a mesma do limite de posts do Grátis. */
export const creditPeriod = (now = new Date()): { periodStart: Date; periodEnd: Date } => ({
  periodStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
  periodEnd: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
});

/**
 * Lease da reserva. Curta de propósito: diferente da posse de publicação, aqui não há efeito
 * externo em voo que um segundo processo pudesse duplicar — o pior caso de recuperar cedo
 * demais é a confirmação tardia virar no-op, e a org sair com franquia a MAIS, nunca a menos.
 */
const LEASE_SEC = 180;

export interface BudgetGuardDeps {
  credits: AiCreditsRepository;
  plan: PlanPolicy;
  /** injetável nos testes */
  now?: () => Date;
}

const formatarData = (d: Date) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(d);

/**
 * Franquia que ESTA org tem no período. Em self-hosted o snapshot vem com `enforced: false` e
 * o teto vira irrelevante — mas ainda abrimos balde, para o consumo ficar contabilizado.
 */
const allowanceFor = async (
  plan: PlanPolicy,
  orgId: string,
): Promise<{ granted: number; enforced: boolean }> => {
  const snapshot = await plan.snapshot(orgId);
  return {
    granted: snapshot.limits.aiCredits ?? PLANS[snapshot.tier].limits.aiCredits,
    enforced: snapshot.enforced,
  };
};

/** teto amplo do não-imposto: alto o bastante para nunca recusar, finito para nunca estourar int */
const SEM_TETO = 1_000_000_000;

export function makeBudgetGuard(deps: BudgetGuardDeps): BudgetGuard {
  const agora = () => deps.now?.() ?? new Date();

  return {
    async reserve(orgId, operation, estimatedCredits) {
      const { granted, enforced } = await allowanceFor(deps.plan, orgId);
      const period = creditPeriod(agora());

      const grant = await deps.credits.reserve({
        orgId,
        operation,
        credits: estimatedCredits,
        // self-hosted contabiliza mas não recusa (DECISIONS §15)
        granted: enforced ? granted : SEM_TETO,
        leaseSec: LEASE_SEC,
        ...period,
      });

      if (!grant) {
        throw new DomainError(
          ErrorCodes.AiBudgetExceeded,
          granted === 0
            ? 'Seu plano não inclui franquia de IA. Assine o Pro para liberar.'
            : `Você usou os ${granted} créditos de IA deste mês. A franquia renova em ${formatarData(period.periodEnd)}.`,
          { granted, operation, renewsAt: period.periodEnd.toISOString() },
        );
      }
      return grant;
    },

    commit: (grantId, actual) =>
      deps.credits.commit(grantId, {
        credits: actual.credits,
        ...(actual.usage ? tokensOf(actual.usage) : {}),
      }),

    release: (grantId) => deps.credits.release(grantId),

    async balance(orgId): Promise<AiBalance> {
      const { granted, enforced } = await allowanceFor(deps.plan, orgId);
      const bucket = await deps.credits.balance({
        orgId,
        granted: enforced ? granted : SEM_TETO,
        ...creditPeriod(agora()),
      });
      return {
        // o saldo REPORTADO usa a franquia do plano; o teto interno do self-hosted não vaza p/ a UI
        granted: enforced ? bucket.granted : granted,
        used: bucket.used,
        reserved: bucket.reserved,
        remaining: Math.max(0, (enforced ? bucket.granted : granted) - bucket.used - bucket.reserved),
        periodEnd: bucket.periodEnd,
        enforced,
      };
    },
  };
}

const tokensOf = (usage: TokenUsage) => ({
  inputTokens: usage.inputTokens,
  outputTokens: usage.outputTokens,
});

/**
 * Executa `work` com a franquia reservada, confirmando o consumo real ou DEVOLVENDO a reserva
 * quando algo dá errado. É a única forma de chamar um modelo neste código base: um caminho que
 * chegue ao provider sem passar por aqui é defeito (SPEC_AI §4).
 *
 * Falha nossa (modelo fora do ar, resposta ilegível) devolve a franquia — os tokens foram
 * gastos lá em cima, mas cobrar a org por um erro nosso é a troca errada (design D8).
 */
export async function withBudget<T>(
  guard: BudgetGuard,
  input: { orgId: string; operation: string; credits: number },
  work: () => Promise<{ result: T; usage?: TokenUsage }>,
): Promise<T> {
  const { grantId } = await guard.reserve(input.orgId, input.operation, input.credits);
  try {
    const { result, usage } = await work();
    await guard.commit(grantId, { credits: input.credits, ...(usage ? { usage } : {}) });
    return result;
  } catch (error) {
    // devolver a franquia não pode mascarar o erro original
    await guard.release(grantId).catch(() => {});
    throw error;
  }
}
