import { describe, expect, test } from 'bun:test';
import { AllowedTransitions, canTransition, PublicationStates } from './publication-state';

describe('máquina de estados de publicação (SPEC_QUEUE §4)', () => {
  test('estados terminais não transicionam', () => {
    expect(AllowedTransitions.PUBLISHED).toHaveLength(0);
    expect(AllowedTransitions.CANCELLED).toHaveLength(0);
  });

  test('incerteza nunca vira repostagem automática (DECISIONS §7)', () => {
    expect(canTransition('PUBLISHING', 'NEEDS_REVIEW')).toBe(true);
    expect(canTransition('NEEDS_REVIEW', 'PUBLISHING')).toBe(false);
  });

  test('retry manual só a partir de FAILED', () => {
    expect(canTransition('FAILED', 'SCHEDULED')).toBe(true);
    expect(canTransition('PUBLISHED', 'SCHEDULED')).toBe(false);
  });

  test('toda transição referencia estados válidos', () => {
    for (const from of PublicationStates) {
      for (const to of AllowedTransitions[from]) {
        expect(PublicationStates).toContain(to);
      }
    }
  });
});
