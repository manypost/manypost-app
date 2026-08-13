/**
 * Tabela de dobra de acento da BUSCA — a autoridade única dos dois lados da comparação.
 *
 * O SQL usa `translate(texto, FROM, TO)` (a extensão `unaccent` foi recusada porque
 * `CREATE EXTENSION` exige privilégio que Postgres gerenciado costuma negar); o cliente dobra por
 * NFD, que cobre um superconjunto disto. Esta tabela é o CONTRATO do subconjunto em que servidor e
 * cliente concordam: "lancamento" precisa achar "Lançamento" nos dois lados. A paridade é
 * assertada por teste (`apps/web/src/lib/text.test.ts`).
 *
 * As duas strings precisam ter o mesmo comprimento em caracteres — `translate` pareia por posição.
 */
export const ACCENT_TRANSLATE_FROM = 'áàâãäéèêëíìîïóòôõöúùûüçñýÿ';
export const ACCENT_TRANSLATE_TO = 'aaaaaeeeeiiiiooooouuuucnyy';
