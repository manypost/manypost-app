/**
 * Abre a autorização OAuth em popup e resolve quando o fluxo termina.
 *
 * O callback (GET /v1/channels/callback/:provider) responde JSON na MESMA
 * origem do app (proxy do Next) — dá pra detectar a chegada nele pelo
 * `location` do popup e fechá-lo. Popup bloqueado → navega na própria aba
 * (o usuário volta pelo histórico; a lista refaz o fetch no focus).
 */
export function openOauthPopup(url: string): Promise<'done' | 'closed'> {
  return new Promise((resolve) => {
    const w = 600;
    const h = 720;
    const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - h) / 2);
    const popup = window.open(
      url,
      'mp-oauth',
      `width=${w},height=${h},left=${left},top=${top},noopener=no`,
    );
    if (!popup) {
      window.location.href = url;
      return; // a promise nunca resolve — a página está saindo
    }
    const timer = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(timer);
        resolve('closed');
        return;
      }
      try {
        // cross-origin lança enquanto o popup está na rede social — esperado
        if (popup.location.pathname.startsWith('/v1/channels/callback/')) {
          window.clearInterval(timer);
          popup.close();
          resolve('done');
        }
      } catch {
        /* ainda no domínio da rede */
      }
    }, 400);
  });
}
