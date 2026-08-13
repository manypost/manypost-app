'use client';

import { useDraggable } from '@dnd-kit/core';
import { MoreHorizontal, Play } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ProviderIcon } from '@/features/channels/provider-icon';
import { cn } from '@/lib/utils';
import { acoesDoCard, type AcaoDoCard, type GroupCard } from './logic';
import type { Densidade } from './use-kanban-prefs';

/**
 * Card do quadro = um grupo de publicação.
 *
 * **Por que é `<article>` e não `<button>`:** o card precisa carregar um checkbox de seleção e um
 * gatilho de menu, e um `<button>` não pode conter outro controle interativo — a marcação fica
 * inválida e navegação por teclado e leitor de tela quebram nela. A estrutura é: `<article>` segura
 * o arraste, um `<button>` interno cobre a região de conteúdo (abre o detalhe), e checkbox e menu
 * ficam ao lado dele, não dentro.
 */
export function KanbanCard({
  card,
  densidade,
  selecionado,
  temSelecao,
  onOpen,
  onToggle,
  onAcao,
}: {
  card: GroupCard;
  densidade: Densidade;
  selecionado: boolean;
  temSelecao: boolean;
  onOpen: (groupId: string) => void;
  onToggle: (groupId: string, faixa: boolean) => void;
  onAcao: (acao: AcaoDoCard, card: GroupCard) => void;
}) {
  const t = useTranslations('kanban');
  const locale = useLocale();
  const compacta = densidade === 'compacta';

  // publicado não se arrasta: não há transição válida saindo dele
  const arrastavel = card.column !== 'published';
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.groupId,
    data: { column: card.column },
    disabled: !arrastavel,
  });

  const quando = card.publishAt
    ? new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(card.publishAt))
    : null;

  const acoes = acoesDoCard(card);

  return (
    <article
      ref={setNodeRef}
      className={cn(
        'group/card relative flex flex-col rounded-card border bg-surface transition-colors duration-200',
        'focus-within:border-accent hover:border-line-strong',
        compacta ? 'gap-2 p-2' : 'gap-2 p-3',
        selecionado ? 'border-accent bg-accent-tint' : 'border-line',
        isDragging && 'opacity-40',
      )}
    >
      {/* controles irmãos do botão de conteúdo — nunca dentro dele */}
      <span
        className={cn(
          'absolute right-1.5 top-1.5 z-10 flex items-center gap-1',
          'opacity-0 transition-opacity duration-200 focus-within:opacity-100 group-hover/card:opacity-100 motion-reduce:transition-none',
          (selecionado || temSelecao) && 'opacity-100',
        )}
      >
        <Checkbox
          checked={selecionado}
          aria-label={t('cardSelect')}
          className="cursor-pointer bg-surface"
          onClick={(e) => onToggle(card.groupId, e.shiftKey)}
        />
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t('cardMenu')}
            className="grid size-6 cursor-pointer place-items-center rounded-key border border-line bg-surface text-graphite outline-none transition-colors duration-200 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <MoreHorizontal className="size-3.5" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {acoes.map((acao) => (
              <DropdownMenuItem
                key={acao}
                className={cn('cursor-pointer', acao === 'cancel' && 'text-state-failed')}
                onSelect={() => onAcao(acao, card)}
              >
                {t(`actions.${acao}`)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </span>

      {/* região de conteúdo: o alvo de arraste e o de abrir são o mesmo gesto em contextos diferentes */}
      <button
        type="button"
        onClick={() => onOpen(card.groupId)}
        {...listeners}
        {...attributes}
        className={cn(
          'flex w-full flex-col gap-2 pr-14 text-left outline-none',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          arrastavel ? 'cursor-grab' : 'cursor-pointer',
        )}
      >
        {quando ? (
          <span
            className={cn(
              'text-meta font-medium tabular-nums',
              card.column === 'failed'
                ? 'text-state-failed'
                : card.column === 'published'
                  ? 'text-state-published'
                  : card.column === 'scheduled'
                    ? 'text-state-scheduled'
                    : 'text-graphite',
            )}
          >
            {quando}
          </span>
        ) : null}
        <p
          className={cn(
            'text-compact leading-relaxed text-ink',
            compacta ? 'line-clamp-2' : 'line-clamp-3',
          )}
        >
          {card.text || '…'}
        </p>
        {card.errorMessage && !compacta ? (
          <p className="line-clamp-2 text-meta leading-relaxed text-state-failed">
            {card.errorMessage}
          </p>
        ) : null}
        {card.mediaPreview && !compacta ? (
          card.mediaPreview.type === 'image' ? (
            <span
              data-media-kind="image"
              className="aspect-preview mt-1 block w-full overflow-hidden rounded-control bg-surface-2"
            >
              <img
                src={card.mediaPreview.url}
                alt={card.mediaPreview.alt ?? ''}
                className="size-full object-cover"
                loading="lazy"
                draggable={false}
              />
            </span>
          ) : (
            <span
              data-media-kind="video"
              aria-label={t('videoPreview')}
              className="aspect-preview mt-1 grid w-full place-items-center rounded-control border border-line bg-surface-2 text-graphite"
            >
              <Play className="size-5" aria-hidden />
            </span>
          )
        ) : null}
      </button>

      <div className="flex items-end justify-between gap-2 border-t border-line pt-2">
        <span className="flex min-w-0 flex-wrap gap-1">
          {card.items.slice(0, 2).map((item) => {
            const account = item.channel.username
              ? `@${item.channel.username.replace(/^@/, '')}`
              : (item.channel.name ?? item.channel.provider);
            return (
              <span
                key={item.id}
                data-channel-identity="true"
                aria-label={`${item.channel.provider}: ${account}`}
                className="flex min-w-0 max-w-full items-center gap-1 rounded-control border border-line bg-main px-2 py-1"
              >
                <ProviderIcon
                  provider={item.channel.provider}
                  name={item.channel.name ?? item.channel.provider}
                  className="size-4"
                />
                <span className="max-w-20 truncate text-meta font-medium text-ink">{account}</span>
              </span>
            );
          })}
          {card.items.length > 2 ? (
            <span
              className="grid min-h-7 min-w-7 place-items-center rounded-control border border-line bg-surface-2 px-1 text-meta font-medium text-graphite"
            >
              +{card.items.length - 2}
            </span>
          ) : null}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {card.origin !== 'WEB' ? <Badge className="px-1.5 py-0.5">{card.origin}</Badge> : null}
          {card.column === 'failed' ? (
            <button
              type="button"
              onClick={() => onAcao('retry', card)}
              className="cursor-pointer text-meta font-medium text-state-failed outline-none hover:underline focus-visible:outline-2 focus-visible:outline-accent"
            >
              {t('retry')}
            </button>
          ) : null}
        </span>
      </div>
    </article>
  );
}
