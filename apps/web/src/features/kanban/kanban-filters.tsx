'use client';

import { Check, Rows2, Rows3, Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useChannels } from '@/features/channels/hooks';
import { cn } from '@/lib/utils';
import { COLUNAS, type ColumnId } from './logic';
import { useKanbanPrefs } from './use-kanban-prefs';

export const JANELAS = [7, 30, 90] as const;
export type Janela = (typeof JANELAS)[number];

export interface EstadoDosFiltros {
  colunas: ColumnId[];
  canais: string[];
  busca: string;
  janela: Janela;
}

/**
 * Filtros do quadro.
 *
 * O estado mora na URL (quem chama é que escreve): um quadro estreitado é uma **visão**, e uma visão
 * deve caber num link — "o quadro, filtrado pelas falhas do Instagram desta semana" é uma frase que
 * alguém manda para um colega. Densidade, ao contrário, descreve a pessoa e fica no navegador.
 */
export function KanbanFilters({
  estado,
  onChange,
  onLimpar,
}: {
  estado: EstadoDosFiltros;
  onChange: (parcial: Partial<EstadoDosFiltros>) => void;
  onLimpar: () => void;
}) {
  const t = useTranslations('kanban');
  const channels = useChannels();
  const { densidade, setDensidade } = useKanbanPrefs();

  const temFiltro =
    estado.colunas.length > 0 || estado.canais.length > 0 || estado.busca.trim().length > 0;

  const alternar = <T,>(lista: T[], valor: T): T[] =>
    lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];

  const rotuloCanais =
    estado.canais.length === 0 ? t('filters.allChannels') : t('filters.active', { count: estado.canais.length });
  const rotuloColunas =
    estado.colunas.length === 0 ? t('filters.allColumns') : t('filters.active', { count: estado.colunas.length });

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface p-3">
      <label className="relative flex min-w-48 flex-1 items-center sm:max-w-64 sm:flex-none">
        <Search className="pointer-events-none absolute left-2.5 size-3.5 text-graphite" aria-hidden />
        <span className="sr-only">{t('filters.search')}</span>
        <Input
          value={estado.busca}
          onChange={(e) => onChange({ busca: e.target.value })}
          placeholder={t('filters.searchPlaceholder')}
          className="h-8 pl-8 text-meta"
        />
      </label>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="cursor-pointer">
            {rotuloCanais}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
          {(channels.data ?? []).map((c) => (
            <DropdownMenuItem
              key={c.id}
              className="cursor-pointer"
              onSelect={(e) => {
                e.preventDefault();
                onChange({ canais: alternar(estado.canais, c.id) });
              }}
            >
              <Check
                className={cn('size-3.5', estado.canais.includes(c.id) ? 'opacity-100' : 'opacity-0')}
                aria-hidden
              />
              {c.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="cursor-pointer">
            {rotuloColunas}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {COLUNAS.map(({ id }) => (
            <DropdownMenuItem
              key={id}
              className="cursor-pointer"
              onSelect={(e) => {
                e.preventDefault();
                onChange({ colunas: alternar(estado.colunas, id) });
              }}
            >
              <Check
                className={cn('size-3.5', estado.colunas.includes(id) ? 'opacity-100' : 'opacity-0')}
                aria-hidden
              />
              {t(`columns.${id}`)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="cursor-pointer tabular-nums">
            {t('filters.windowDays', { days: estado.janela })}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {JANELAS.map((d) => (
            <DropdownMenuItem
              key={d}
              className="cursor-pointer tabular-nums"
              onSelect={() => onChange({ janela: d })}
            >
              <Check
                className={cn('size-3.5', estado.janela === d ? 'opacity-100' : 'opacity-0')}
                aria-hidden
              />
              {t('filters.windowDays', { days: d })}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {temFiltro ? (
        <Button variant="ghost" size="sm" className="cursor-pointer gap-1.5" onClick={onLimpar}>
          <X className="size-3.5" aria-hidden />
          {t('filters.clear')}
        </Button>
      ) : null}

      <Button
        variant="outline"
        size="icon-sm"
        aria-label={t('density.label')}
        title={densidade === 'compacta' ? t('density.comfortable') : t('density.compact')}
        className="ml-auto cursor-pointer"
        onClick={() => setDensidade(densidade === 'compacta' ? 'confortavel' : 'compacta')}
      >
        {densidade === 'compacta' ? (
          <Rows2 className="size-3.5" aria-hidden />
        ) : (
          <Rows3 className="size-3.5" aria-hidden />
        )}
      </Button>
    </div>
  );
}
