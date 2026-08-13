/**
 * Casamento e ordenação da paleta — PUROS.
 *
 * Foi o motivo principal de não trazer `cmdk`: o repositório roda `bun test` sem DOM, então função
 * pura é a única coisa verificável aqui. Um motor de pontuação de terceiros seria justamente a
 * parte que não conseguiríamos afirmar nada sobre.
 *
 * E determinismo não é preciosismo: uma paleta cuja primeira linha muda de lugar entre teclas para
 * a mesma entrada ensina a pessoa a não confiar na primeira linha — que é a linha de que a
 * interação inteira depende.
 */

/** caixa baixa sem diacrítico: "conexoes" precisa achar "Conexões" */
export const normalizar = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

export interface Rankeavel {
  chave: string;
  rotulo: string;
  /** palavras extras que também casam (sinônimos, nome da rota sem acento) */
  termos: string;
  /** menor = mais importante no desempate; ação vem antes de tela, tela antes de canal */
  peso: number;
}

const PONTOS = {
  prefixo: 1000,
  inicioDePalavra: 700,
  substring: 400,
  subsequencia: 100,
} as const;

/** todas as letras da consulta aparecem na ordem, mesmo separadas ("cfg" → "configuracoes") */
function ehSubsequencia(alvo: string, consulta: string): boolean {
  let i = 0;
  for (const ch of alvo) {
    if (ch === consulta[i]) i++;
    if (i === consulta.length) return true;
  }
  return false;
}

/**
 * Força do casamento de UM texto. `0` = não casa.
 *
 * A escala é grosseira de propósito: quatro degraus bem separados, mais um bônus pequeno para alvo
 * curto. Assim a ordem é explicável em uma frase ("casou no começo, casou no começo de palavra,
 * casou no meio, casou espalhado") em vez de sair de um número que ninguém sabe reproduzir.
 */
export function pontuar(alvo: string, consulta: string): number {
  const a = normalizar(alvo);
  const c = normalizar(consulta).trim();
  if (!c || !a) return 0;

  let base = 0;
  if (a.startsWith(c)) base = PONTOS.prefixo;
  else if (new RegExp(`\\b${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(a))
    base = PONTOS.inicioDePalavra;
  else if (a.includes(c)) base = PONTOS.substring;
  else if (ehSubsequencia(a, c)) base = PONTOS.subsequencia;
  else return 0;

  // alvo curto que casa é mais provável de ser o que se procura que um texto longo
  return base + Math.max(0, 40 - a.length);
}

/**
 * Ordena por força do casamento, desempatando por peso do tipo e depois pela ordem do catálogo.
 *
 * `sort` do JS é estável, então a ordem original é o último critério sem precisar de índice
 * explícito — e é isso que garante "mesma entrada, mesma saída".
 */
export function ordenar<T extends Rankeavel>(itens: T[], consulta: string, limite: number): T[] {
  const c = consulta.trim();
  if (!c) return [];

  const comNota = itens
    .map((item) => ({ item, nota: Math.max(pontuar(item.rotulo, c), pontuar(item.termos, c)) }))
    .filter((x) => x.nota > 0);

  comNota.sort((x, y) => y.nota - x.nota || x.item.peso - y.item.peso);
  return comNota.slice(0, limite).map((x) => x.item);
}
