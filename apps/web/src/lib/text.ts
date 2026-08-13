/**
 * Caixa baixa sem diacrítico — a ÚNICA dobra de acento do cliente.
 *
 * Usada pela paleta de comandos e pelos filtros do Quadro: "conexoes" acha "Conexões" nos dois
 * lugares porque a regra é uma só. A busca do servidor dobra por `translate` com a tabela de
 * `@manypost/contracts`; a paridade entre as duas dobras é assertada em `text.test.ts` — NFD
 * cobre um superconjunto da tabela, e a tabela é o contrato mínimo em que os lados concordam.
 */
export const normalizarTexto = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
