import { describe, expect, it } from 'bun:test';

type OauthMessageGuard = (
  event: Pick<MessageEvent, 'data' | 'origin' | 'source'>,
  popup: Window,
  appOrigin: string,
) => boolean;

const oauthPopupModule = (await import('./oauth-popup')) as unknown as {
  isExpectedOauthMessage?: OauthMessageGuard;
};
const guard = oauthPopupModule.isExpectedOauthMessage;
const popup = {} as Window;
const otherPopup = {} as Window;
const message = (
  origin: string,
  source: MessageEventSource | null,
): Pick<MessageEvent, 'data' | 'origin' | 'source'> => ({
  origin,
  source,
  data: { type: 'manypost:oauth:success' },
});

describe('mensagem de conclusão do popup OAuth', () => {
  it('aceita a mensagem esperada da própria origem e do popup aberto', () => {
    expect(guard?.(message('https://app.manypost.test', popup), popup, 'https://app.manypost.test')).toBe(
      true,
    );
  });

  it('recusa uma mensagem com a mesma forma enviada por outra origem', () => {
    expect(guard?.(message('https://evil.test', popup), popup, 'https://app.manypost.test')).toBe(
      false,
    );
  });

  it('recusa uma mensagem enviada por outra janela', () => {
    expect(
      guard?.(message('https://app.manypost.test', otherPopup), popup, 'https://app.manypost.test'),
    ).toBe(false);
  });
});
