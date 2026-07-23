export const SSE_KEEPALIVE_MS = 25_000;
export const SERVER_IDLE_TIMEOUT_SEC = 30;

export const serverNetworkOptions = {
  hostname: '0.0.0.0',
  idleTimeout: SERVER_IDLE_TIMEOUT_SEC,
} as const;
