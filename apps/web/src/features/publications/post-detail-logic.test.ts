import { describe, expect, test } from 'bun:test';
import { entradasDeTextoDoDetalhe } from './post-detail-logic';

describe('conteúdo do detalhe aberto por deep link', () => {
  test('usa as publicações do GET do grupo quando o feed não contém o rascunho', () => {
    expect(
      entradasDeTextoDoDetalhe([], [
        { id: 'pub-1', channelId: 'canal-1', text: 'Ajustar a legenda' },
      ]),
    ).toEqual([{ key: 'pub-1', channelId: 'canal-1', text: 'Ajustar a legenda' }]);
  });

  test('prefere o feed quando ele já trouxe o grupo', () => {
    expect(
      entradasDeTextoDoDetalhe(
        [{ id: 'feed-1', channelId: 'canal-1', text: 'Texto do feed' }],
        [{ id: 'pub-1', channelId: 'canal-1', text: 'Texto do detalhe' }],
      ),
    ).toEqual([{ key: 'feed-1', channelId: 'canal-1', text: 'Texto do feed' }]);
  });
});
