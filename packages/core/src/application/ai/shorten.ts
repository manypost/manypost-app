/**
 * Garantia determinística de tamanho (SPEC_AI §5.5 / design D7).
 *
 * O prompt PEDE o limite do canal, mas prompt nenhum entrega 100% de nada — e "100% dos casos"
 * é literalmente o critério de aceite. Então o limite é imposto depois: o texto é cortado na
 * última fronteira de frase que couber e, se não houver nenhuma, na última palavra. O chamador
 * recebe `shortened: true` para a UI poder dizer ao usuário o que aconteceu, em vez de entregar
 * um texto que o agendamento recusaria depois com `post.too_long`.
 */

export interface Shortened {
  text: string;
  /** true = o modelo passou do limite e nós cortamos */
  shortened: boolean;
}

/** fim de frase seguido de espaço (ou fim do texto) — inclui os fechamentos usuais */
const FIM_DE_FRASE = /[.!?…](?:["'”’)\]]*)(?=\s|$)/g;

const ultimoFimDeFrase = (texto: string): number => {
  let fim = -1;
  for (const m of texto.matchAll(FIM_DE_FRASE)) fim = m.index + m[0].length;
  return fim;
};

export function shortenTo(raw: string, maxLength: number): Shortened {
  const text = raw.trim();
  if (maxLength <= 0) return { text: '', shortened: text.length > 0 };
  if ([...text].length <= maxLength) return { text, shortened: false };

  // corta por CARACTERE, não por code unit: emoji e acento contam como o usuário conta
  const cortado = [...text].slice(0, maxLength).join('');

  const frase = ultimoFimDeFrase(cortado);
  // só aceita a fronteira de frase se ela não jogar fora mais da metade do que cabia —
  // devolver duas palavras quando cabiam 280 caracteres seria pior que cortar na palavra
  if (frase > maxLength / 2) return { text: cortado.slice(0, frase).trim(), shortened: true };

  const palavra = cortado.replace(/\s+\S*$/, '').trim();
  return { text: (palavra.length > 0 ? palavra : cortado).trim(), shortened: true };
}
