export type RealtimeSessionAction = 'open' | 'expire' | 'retry';

export function realtimeSessionAction(
  response: Response | null | undefined,
): RealtimeSessionAction {
  if (response?.ok) return 'open';
  if (response?.status === 401) return 'expire';
  return 'retry';
}

export async function expireBrowserSession(input: {
  logout: () => Promise<unknown>;
  navigate: (path: string) => void;
}): Promise<void> {
  await input.logout().catch(() => undefined);
  input.navigate('/login');
}
