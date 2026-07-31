/**
 * O contrato de teclado da paleta, PURO.
 *
 * Duas regras aqui são as que quebram na prática e que ninguém lembra de testar clicando: o atalho
 * **não pode** disparar enquanto a pessoa escreve — abrir a paleta no meio de um post é o pior
 * defeito possível neste produto — e a navegação precisa dar a volta nas pontas, senão a última
 * linha vira um beco.
 */

export interface TeclaDeAtalho {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  repeat?: boolean;
  /** o elemento que estava com o foco quando a tecla foi pressionada */
  target?: { tagName?: string; isContentEditable?: boolean } | null;
}

const CAMPOS_DE_TEXTO = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** o foco está num lugar onde a pessoa está digitando de verdade? */
export function focoEmCampoDeTexto(alvo: TeclaDeAtalho['target']): boolean {
  if (!alvo) return false;
  if (alvo.isContentEditable) return true;
  return CAMPOS_DE_TEXTO.has((alvo.tagName ?? '').toUpperCase());
}

/**
 * ⌘K no mac, Ctrl+K no resto. Recusa auto-repeat (segurar a tecla não deve reabrir) e recusa
 * quando o foco está num campo de texto ou num editor.
 */
export function abrePalette(e: TeclaDeAtalho): boolean {
  if (e.key.toLowerCase() !== 'k') return false;
  if (!e.metaKey && !e.ctrlKey) return false;
  if (e.repeat) return false;
  return !focoEmCampoDeTexto(e.target);
}

/** move a seleção com volta nas pontas; lista vazia devolve -1 (nada selecionável) */
export function moverSelecao(tecla: string, indice: number, total: number): number {
  if (total <= 0) return -1;
  if (tecla === 'ArrowDown') return (indice + 1) % total;
  if (tecla === 'ArrowUp') return (indice - 1 + total) % total;
  if (tecla === 'Home') return 0;
  if (tecla === 'End') return total - 1;
  return indice;
}
