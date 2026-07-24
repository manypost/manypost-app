import { describe, expect, test } from 'bun:test';

/**
 * Smoke estrutural: o módulo de consentimento exporta a view usada pela rota
 * `/oauth/consent`. Testes de interação cobrem o E2E OAuth.
 */
describe('oauth consent module', () => {
  test('exporta OAuthConsentView', async () => {
    const mod = await import('./oauth-consent-view');
    expect(typeof mod.OAuthConsentView).toBe('function');
  });
});
