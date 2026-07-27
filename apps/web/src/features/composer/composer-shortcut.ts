interface EstadoDoAtalho {
  bloqueado: boolean;
  enviando: boolean;
  overlayBloqueanteAberto: boolean;
  repeticao: boolean;
}

/** Evita submissões concorrentes ou escondidas atrás de um diálogo modal. */
export function podeAgendarPorAtalho(estado: EstadoDoAtalho): boolean {
  return (
    !estado.bloqueado &&
    !estado.enviando &&
    !estado.overlayBloqueanteAberto &&
    !estado.repeticao
  );
}
