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

    let finished = false;
    const finish = (result: 'done' | 'closed') => {
      if (finished) return;
      finished = true;
      window.clearInterval(timer);
      window.removeEventListener('message', onMessage);
      if (popup && !popup.closed) {
        try {
          popup.close();
        } catch {
          /* ignore */
        }
      }
      resolve(result);
    };

    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'manypost:oauth:success' || e.data?.type === 'manypost:oauth:done') {
        finish('done');
      }
    };
    window.addEventListener('message', onMessage);

    const timer = window.setInterval(() => {
      if (popup.closed) {
        // Se fechou via window.close() do HTML ou pelo usuário, e estamos com onMessage processado ou pós-callback
        finish('closed');
        return;
      }
      try {
        if (popup.location.pathname.startsWith('/v1/channels/callback/')) {
          // Apenas fechamos e marcamos done quando o DOM da página de callback estiver completamente carregado ou indicar sucesso
          if (popup.document.readyState === 'complete') {
            const text = popup.document.body?.innerText ?? '';
            if (text.includes('Conectado!') || text.includes('sucesso') || text.includes('id')) {
              finish('done');
            }
          }
        }
      } catch {
        /* ainda no domínio da rede social */
      }
    }, 300);
  });
}
