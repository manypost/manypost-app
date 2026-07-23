import type { ProviderContext } from '@manypost/contracts';

// Derived from Postiz (AGPL-3.0): libraries/nestjs-libraries/src/integrations/social/facebook.provider.ts
// e instagram.provider.ts — a resolução das Páginas administradas (`/me/accounts` + Business Manager
// `owned_pages`/`client_pages`, paginando e deduplicando) é a MESMA nos dois providers da Meta que
// publicam por Página. Aqui ela tem fonte única; o que muda por provider são os `fields` (o
// `instagram` pede também o `instagram_business_account` de cada Página).

/** Graph API do Facebook — a mesma base serve Facebook Pages e Instagram via Facebook Business. */
export const GRAPH_BASE = 'https://graph.facebook.com/v20.0';

/**
 * Chamada à Graph API da Meta. Erro é `{ error: { message, type, code, error_subcode } }`; alguns
 * endpoints devolvem esse envelope com HTTP 200, por isso checamos o corpo também. O corpo cru vai
 * no throw para o `classifyError` de cada provider casar código e mensagem.
 */
export async function metaFetch<T>(
  ctx: ProviderContext,
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await ctx.fetch(url, init);
  const text = await res.text();
  if (!res.ok) throw { status: res.status, body: text.slice(0, 2000) };
  const json = (text ? JSON.parse(text) : {}) as { error?: unknown };
  if (json.error) throw { status: 400, body: text.slice(0, 2000) };
  return json as T;
}

export interface GraphPage {
  id: string;
  name: string;
  username?: string;
  picture?: { data?: { url?: string } };
  /** presente só quando a Página tem uma conta profissional do Instagram vinculada */
  instagram_business_account?: { id: string };
}

/**
 * Páginas administradas pela pessoa: `/me/accounts` (as escolhidas no diálogo) + Business Manager
 * (`owned_pages`/`client_pages`, para as que não apareceram no passo de seleção). O Business Manager
 * exige `business_management` e nem todo usuário tem — por isso é best-effort (try/catch).
 */
export async function fetchPages(
  ctx: ProviderContext,
  userToken: string,
  fields: string,
): Promise<GraphPage[]> {
  const seen = new Set<string>();
  const all: GraphPage[] = [];

  const paginate = async (start: string) => {
    let next: string | undefined = start;
    while (next) {
      // tipo anotado (não inferido) — `next` é reatribuído a partir de `resp`, o que criaria inferência circular
      const resp: { data?: GraphPage[]; paging?: { next?: string } } = await metaFetch(ctx, next);
      for (const pg of resp.data ?? []) {
        if (!seen.has(pg.id)) {
          seen.add(pg.id);
          all.push(pg);
        }
      }
      next = resp.paging?.next;
    }
  };

  await paginate(`${GRAPH_BASE}/me/accounts?fields=${fields}&limit=100&access_token=${userToken}`);

  try {
    let bizUrl: string | undefined = `${GRAPH_BASE}/me/businesses?access_token=${userToken}`;
    while (bizUrl) {
      const biz: { data?: Array<{ id: string }>; paging?: { next?: string } } = await metaFetch(
        ctx,
        bizUrl,
      );
      for (const b of biz.data ?? []) {
        for (const edge of ['owned_pages', 'client_pages']) {
          try {
            await paginate(
              `${GRAPH_BASE}/${b.id}/${edge}?fields=${fields}&limit=100&access_token=${userToken}`,
            );
          } catch {
            // outra Página/negócio pode falhar isolado — segue
          }
        }
      }
      bizUrl = biz.paging?.next;
    }
  } catch {
    // Business Manager indisponível para esta conta — /me/accounts já basta
  }

  return all;
}
