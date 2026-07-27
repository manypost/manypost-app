import { describe, expect, it } from 'bun:test';
import {
  PLANS,
  PlanFeatures,
  PlanTiers,
  UNLIMITED,
  isWithinLimit,
  minimumTierFor,
  monthlyEquivalent,
  planHasFeature,
  type PlanFeature,
} from './billing';

/**
 * O catálogo é a FONTE ÚNICA da verdade comercial: uma feature paga que não entre aqui sai de
 * graça no gerenciado. Estes testes prendem o que a landing promete — não a implementação.
 */
describe('catálogo de planos ↔ página de preços', () => {
  it('as features de IA do Pro são as duas que a landing lista', () => {
    expect(minimumTierFor('ai_caption')).toBe('PRO');
    expect(minimumTierFor('ai_best_time')).toBe('PRO');
  });

  it('as features de IA avançada exigem Premium', () => {
    for (const feature of [
      'ai_multichannel_draft',
      'ai_calendar',
      'ai_inbox',
      'ai_triage',
      'ai_campaign_reports',
      'ai_engagement_alerts',
    ] as const) {
      expect(minimumTierFor(feature)).toBe('PREMIUM');
    }
  });

  it('o Grátis não inclui IA nenhuma — nem feature, nem franquia', () => {
    const deIa = PlanFeatures.filter((f) => f.startsWith('ai_'));
    for (const feature of deIa) expect(planHasFeature('FREE', feature)).toBe(false);
    expect(PLANS.FREE.limits.aiCredits).toBe(0);
  });

  it('todo plano pago tem franquia de IA (feature sem franquia seria promessa vazia)', () => {
    for (const tier of ['PRO', 'PREMIUM'] as const) {
      const temIa = PLANS[tier].features.some((f) => f.startsWith('ai_'));
      expect(temIa).toBe(true);
      expect(PLANS[tier].limits.aiCredits).toBeGreaterThan(0);
    }
  });

  it('a franquia de IA cresce com o plano', () => {
    expect(PLANS.PREMIUM.limits.aiCredits).toBeGreaterThan(PLANS.PRO.limits.aiCredits);
  });

  it('o Premium inclui tudo do Pro (upgrade nunca tira feature)', () => {
    for (const feature of PLANS.PRO.features) {
      expect(planHasFeature('PREMIUM', feature)).toBe(true);
    }
  });

  it('toda feature do catálogo pertence a pelo menos um plano', () => {
    const emAlgumPlano = new Set<PlanFeature>(PlanTiers.flatMap((t) => [...PLANS[t].features]));
    for (const feature of PlanFeatures) expect(emAlgumPlano.has(feature)).toBe(true);
  });

  it('o Grátis não cobra e os pagos têm os dois períodos', () => {
    expect(PLANS.FREE.prices.MONTHLY).toBeNull();
    expect(PLANS.FREE.prices.YEARLY).toBeNull();
    for (const tier of ['PRO', 'PREMIUM'] as const) {
      expect(PLANS[tier].prices.MONTHLY).not.toBeNull();
      expect(PLANS[tier].prices.YEARLY).not.toBeNull();
    }
  });

  // os números que a landing exibe: "R$ 23,90/mês" no anual do Pro, "R$ 52,90" no Premium
  it('o mensal equivalente do anual bate com o que a landing anuncia', () => {
    expect(monthlyEquivalent(PLANS.PRO.prices.YEARLY!, 'YEARLY')).toBe(2390);
    expect(monthlyEquivalent(PLANS.PREMIUM.prices.YEARLY!, 'YEARLY')).toBe(5290);
    expect(monthlyEquivalent(PLANS.PRO.prices.MONTHLY!, 'MONTHLY')).toBe(2990);
  });

  it('os limites do Grátis são os anunciados', () => {
    expect(PLANS.FREE.limits).toMatchObject({ channels: 3, postsPerMonth: 15 });
  });

  it('o sentinela de ilimitado nunca barra', () => {
    expect(isWithinLimit(UNLIMITED, 999_999)).toBe(true);
    expect(isWithinLimit(3, 3)).toBe(false);
    expect(isWithinLimit(3, 2)).toBe(true);
  });
});
