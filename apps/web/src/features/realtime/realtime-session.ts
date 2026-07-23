export type RealtimeSessionAction = 'open' | 'expire' | 'retry';

export function realtimeSessionAction(
  response: Response | null | undefined,
): RealtimeSessionAction {
  if (response?.ok) return 'open';
  if (response?.status === 401) return 'expire';
  return 'retry';
}

export function clearSessionHint(target: { cookie: string }): void {
  target.cookie = 'mp_session=; Path=/; Max-Age=0; SameSite=Lax';
}

export async function expireBrowserSession(input: {
  logout: () => Promise<unknown>;
  target: { cookie: string };
  navigate: (path: string) => void;
}): Promise<void> {
  await input.logout().catch(() => undefined);
  clearSessionHint(input.target);
  input.navigate('/login');
}
