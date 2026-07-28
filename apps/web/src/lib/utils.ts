import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/*
 * O Tailwind v4 gera estas utilities a partir de `--text-*` em globals.css.
 * Sem registrar a escala, tailwind-merge trata `text-compact` como cor e a
 * coloca em conflito com `text-paper`/`text-ink`: ou o tamanho ou o contraste
 * desaparece, conforme a ordem das classes.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['calendar-hour', 'axis', 'meta', 'compact', 'panel'],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
