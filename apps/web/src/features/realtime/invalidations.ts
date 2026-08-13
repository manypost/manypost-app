/**
 * O que cada evento do SSE invalida — como DADO, não como `switch`.
 *
 * Isto existe por causa de um defeito concreto: nenhum evento invalidava `['insights']`, então a
 * tela inicial — o painel do "está tudo bem?" — só se atualizava depois de 20 segundos de
 * `staleTime` ou de a janela recuperar o foco. Uma falha nova ficava invisível e uma falha já
 * resolvida continuava na tela depois de a pessoa arrumar, que é a maneira mais rápida de ensinar
 * alguém a não confiar num painel.
 *
 * Ser função pura é o que torna a correção verificável: `bun test` não tem DOM, então o hook não
 * pode ser exercitado, mas um mapa pode — e a regressão vira asserção em vez de promessa.
 */

export const EVENTOS_SSE = [
  'post.scheduled',
  'post.published',
  'post.failed',
  'channel.refresh_required',
  'notification.created',
] as const;

export type EventoSse = (typeof EVENTOS_SSE)[number];

/** entrega mexe no feed, no detalhe e nas contagens da home */
const ENTREGA: string[][] = [['publications'], ['post-group'], ['insights']];

const MAPA: Record<EventoSse, string[][]> = {
  'post.scheduled': ENTREGA,
  'post.published': ENTREGA,
  'post.failed': ENTREGA,
  // a home conta canais que precisam de ação: mudou o estado do canal, mudou a contagem
  'channel.refresh_required': [['channels'], ['insights']],
  'notification.created': [['notifications']],
};

/**
 * Chaves a invalidar para um evento. Evento desconhecido devolve `[]` de propósito: invalidar tudo
 * "por precaução" transformaria um evento que não entendemos numa tempestade de refetch.
 */
export const chavesInvalidadasPor = (evento: string): string[][] =>
  MAPA[evento as EventoSse] ?? [];
