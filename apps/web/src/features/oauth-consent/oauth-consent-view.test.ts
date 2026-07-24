import { describe, expect, test } from 'bun:test';
import { consentRedirectHostname } from './oauth-consent-view';

/**
 * Smoke estrutural: o módulo de consentimento exporta a view usada pela rota
 * `/oauth/consent`. Testes de interação cobrem o E2E OAuth.
 */
describe('oauth consent module', () => {
  test('exporta OAuthConsentView', async () => {
    const mod = await import('./oauth-consent-view');
    expect(typeof mod.OAuthConsentView).toBe('function');
  });

  test('extrai hostname de redirect loopback para o aviso MCP', () => {
    expect(consentRedirectHostname('http://127.0.0.1:19876/mcp/oauth/callback')).toBe('127.0.0.1');
    expect(consentRedirectHostname('http://localhost:3118/callback')).toBe('localhost');
    expect(consentRedirectHostname('not-a-uri')).toBeNull();
  });
});
