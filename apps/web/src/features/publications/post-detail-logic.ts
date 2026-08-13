interface FonteDeTextoDoDetalhe {
  id: string;
  channelId: string;
  text: string;
}

export interface EntradaDeTextoDoDetalhe {
  key: string;
  channelId: string;
  text: string;
}

/**
 * O feed é uma otimização visual, não a fonte de verdade do detalhe. Rascunhos sem data ficam fora
 * da janela do Quadro e, quando abertos por deep link, precisam cair para o GET escopado do grupo.
 */
export function entradasDeTextoDoDetalhe(
  feed: FonteDeTextoDoDetalhe[],
  publications: FonteDeTextoDoDetalhe[],
): EntradaDeTextoDoDetalhe[] {
  const fontes = feed.length > 0 ? feed : publications;
  return fontes.map((fonte) => ({
    key: fonte.id,
    channelId: fonte.channelId,
    text: fonte.text,
  }));
}
