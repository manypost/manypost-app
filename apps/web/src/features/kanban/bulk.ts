import type { GroupCard } from './logic';

/**
 * Ações em lote como decisão PURA.
 *
 * Não existe endpoint de lote, e isso é deliberado (design.md): um endpoint precisaria de contrato
 * próprio de falha parcial e idempotência própria, e reimplementaria a validação por post que
 * `makeRetryPost`/`makeCancelPost` já fazem. O lote aqui é leque limitado sobre as operações que já
 * existem — e a consequência é que **falha parcial é o caso normal**, não a exceção: um retry sobre
 * oito canais quase sempre tem algum canal ainda desconectado.
 *
 * Daí as duas funções deste arquivo: uma diz o que NÃO vai ser tentado antes de tentar, a outra
 * conta o que aconteceu sem arredondar para "deu certo".
 */

export type AcaoEmLote = 'retry' | 'cancel';

export type MotivoIgnorado = 'notRetryable' | 'notCancellable';

/** teto da seleção: 50 posts a concorrência 4 é um pico limitado, não uma estampida */
export const LIMITE_DO_LOTE = 50;

/** concorrência do leque — baixa de propósito: a API é a mesma que serve a tela */
export const CONCORRENCIA_DO_LOTE = 4;

export interface PlanoDoLote {
  elegiveis: GroupCard[];
  ignorados: Array<{ groupId: string; motivo: MotivoIgnorado }>;
  excedeLimite: boolean;
}

const ELEGIVEL: Record<AcaoEmLote, (c: GroupCard) => boolean> = {
  retry: (c) => c.column === 'failed',
  cancel: (c) => c.column === 'draft' || c.column === 'awaiting' || c.column === 'scheduled',
};

const MOTIVO: Record<AcaoEmLote, MotivoIgnorado> = {
  retry: 'notRetryable',
  cancel: 'notCancellable',
};

/**
 * Separa o que será tentado do que não será, com o motivo.
 *
 * A pessoa é avisada do que não vai ser tentado **antes** de não ser tentado — descobrir depois,
 * num relatório, ensina a não confiar na seleção.
 */
export function planoDoLote(cards: GroupCard[], acao: AcaoEmLote): PlanoDoLote {
  const elegiveis: GroupCard[] = [];
  const ignorados: PlanoDoLote['ignorados'] = [];
  for (const c of cards) {
    if (ELEGIVEL[acao](c)) elegiveis.push(c);
    else ignorados.push({ groupId: c.groupId, motivo: MOTIVO[acao] });
  }
  return { elegiveis, ignorados, excedeLimite: cards.length > LIMITE_DO_LOTE };
}

export interface ResultadoDoItem {
  groupId: string;
  ok: boolean;
  erro?: string;
}

export interface ResumoDoLote {
  tipo: 'vazio' | 'allOk' | 'partial' | 'allFailed';
  ok: number;
  fail: number;
  falhas: Array<{ groupId: string; erro: string }>;
}

/** conta o que aconteceu de verdade — "tudo falhou" não é reportado como sucesso parcial */
export function resumoDoLote(resultados: ResultadoDoItem[]): ResumoDoLote {
  const falhas = resultados
    .filter((r) => !r.ok)
    .map((r) => ({ groupId: r.groupId, erro: r.erro ?? '' }));
  const ok = resultados.length - falhas.length;
  const fail = falhas.length;

  const tipo: ResumoDoLote['tipo'] =
    resultados.length === 0 ? 'vazio' : fail === 0 ? 'allOk' : ok === 0 ? 'allFailed' : 'partial';

  return { tipo, ok, fail, falhas };
}

/**
 * Executa `tarefa` sobre a lista com concorrência limitada, preservando a ordem dos resultados.
 *
 * Não usa `Promise.all` porque cinquenta requisições simultâneas contra a própria API que está
 * servindo a tela transformam uma ação de recuperação em um segundo incidente.
 */
export async function executarComConcorrencia<T>(
  itens: T[],
  limite: number,
  tarefa: (item: T) => Promise<ResultadoDoItem>,
): Promise<ResultadoDoItem[]> {
  const resultados: ResultadoDoItem[] = new Array(itens.length);
  let proximo = 0;

  const trabalhador = async () => {
    for (;;) {
      const i = proximo++;
      if (i >= itens.length) return;
      resultados[i] = await tarefa(itens[i]!);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, trabalhador));
  return resultados;
}
