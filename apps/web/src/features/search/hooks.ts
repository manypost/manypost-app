'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { api } from '@/lib/api/client';
import { unwrap } from '@/lib/api/unwrap';

/** o servidor recusa consulta com menos que isto — não vale a pena nem sair do navegador */
export const MIN_BUSCA = 2;
const DEBOUNCE_MS = 250;

interface PaletteState {
  aberta: boolean;
  abrir: () => void;
  fechar: () => void;
  alternar: () => void;
}

export const useCommandPalette = create<PaletteState>((set) => ({
  aberta: false,
  abrir: () => set({ aberta: true }),
  fechar: () => set({ aberta: false }),
  alternar: () => set((s) => ({ aberta: !s.aberta })),
}));

/** atrasa o valor — evita uma requisição por tecla digitada */
function useDebounce<T>(valor: T, ms: number): T {
  const [atrasado, setAtrasado] = useState(valor);
  useEffect(() => {
    const id = setTimeout(() => setAtrasado(valor), ms);
    return () => clearTimeout(id);
  }, [valor, ms]);
  return atrasado;
}

/**
 * Busca de posts.
 *
 * Fica numa consulta separada das telas e ações de propósito: aquelas saem de dado já em memória e
 * respondem na primeira tecla, esta precisa de rede. Separadas, uma busca lenta ou fora do ar
 * degrada só a própria seção — a paleta continua servindo para navegar.
 */
export function useSearchPosts(consulta: string) {
  const q = useDebounce(consulta.trim(), DEBOUNCE_MS);
  return useQuery({
    queryKey: ['search', q],
    enabled: q.length >= MIN_BUSCA,
    staleTime: 30_000,
    queryFn: async () => {
      const data = unwrap(await api.GET('/v1/search', { params: { query: { q } } }));
      return data?.items ?? [];
    },
  });
}
