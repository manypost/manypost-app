type TokenProvider = () => Promise<string | null>;
type ExchangeRequest = (token: string) => Promise<boolean>;

let tokenProvider: TokenProvider | null = null;
let recovering: Promise<boolean> | null = null;

export function setClerkTokenProvider(provider: TokenProvider | null) {
  tokenProvider = provider;
}

const requestExchange: ExchangeRequest = async (token) => {
  const response = await fetch('/v1/auth/clerk/exchange', {
    method: 'POST',
    credentials: 'include',
    headers: { authorization: `Bearer ${token}` },
  });
  return response.ok;
};

export function recoverInternalSession(
  request: ExchangeRequest = requestExchange,
): Promise<boolean> {
  if (!tokenProvider) return Promise.resolve(false);
  recovering ??= tokenProvider()
    .then((token) => (token ? request(token) : false))
    .catch(() => false)
    .finally(() => {
      recovering = null;
    });
  return recovering;
}
