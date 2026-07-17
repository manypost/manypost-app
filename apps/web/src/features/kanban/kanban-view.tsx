'use client';

import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { CircleAlert } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useComposerModal } from '@/features/composer/use-composer-modal';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PROVIDER_ICONS } from '@/features/channels/provider-icon';
import { PostDetailSheet } from '@/features/publications/post-detail-sheet';
import { usePublicationsFeed, useRetryPost } from '@/features/publications/hooks';
import { useApiErrorMessage } from '@/lib/api/errors';
import type { components } from '@/lib/api/schema';
import { cn } from '@/lib/utils';

type FeedItem = components['schemas']['FeedItem'];

type ColumnId = 'draft' | 'awaiting' | 'scheduled' | 'published' | 'failed';

const COLUMNS: Array<{ id: ColumnId; accent: string }> = [
  { id: 'draft', accent: 'border-t-mist' },
  { id: 'awaiting', accent: 'border-t-state-review' },
  { id: 'scheduled', accent: 'border-t-state-scheduled' },
  { id: 'published', accent: 'border-t-state-published' },
  { id: 'failed', accent: 'border-t-state-failed' },
];

interface GroupCard {
  groupId: string;
  state: string;
  awaitingApproval: boolean;
  origin: string;
  publishAt: string | null;
  text: string;
  items: FeedItem[];
  errorMessage: string | null;
  column: ColumnId;
}

/**
 * Coluna a partir do estado do GRUPO (DRAFT/SCHEDULED/DONE/PARTIAL/CANCELLED).
 * PARTIAL (terminal misto) cai em Falhou se alguma publicação pede ação
 * humana; senão conta como publicado.
 */
function columnOf(state: string, awaiting: boolean, items: FeedItem[]): ColumnId | null {
  if (state === 'DRAFT') return awaiting ? 'awaiting' : 'draft';
  if (state === 'SCHEDULED') {
    // grupo fica SCHEDULED enquanto houver pendente — falha já visível vai p/ Falhou
    return items.some((i) => i.state === 'FAILED' || i.state === 'NEEDS_REVIEW')
      ? 'failed'
      : 'scheduled';
  }
  if (state === 'DONE') return 'published';
  if (state === 'PARTIAL')
    return items.some((i) => i.state === 'FAILED' || i.state === 'NEEDS_REVIEW')
      ? 'failed'
      : 'published';
  return null; // CANCELLED fica fora do quadro
}

/** Card do kanban = grupo (conteúdo truncado, canais empilhados, horário, origem). */
function KanbanCard({ card, onOpen }: { card: GroupCard; onOpen: (groupId: string) => void }) {
  const locale = useLocale();
  const draggable = card.column === 'failed';
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.groupId,
    data: { column: card.column },
    disabled: !draggable,
  });

  const when = card.publishAt
    ? new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(card.publishAt))
    : null;

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => onOpen(card.groupId)}
      {...listeners}
      {...attributes}
      className={cn(
        'flex w-full flex-col gap-2 rounded-md border border-line bg-surface p-3 text-left outline-none transition-colors duration-200',
        'hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        draggable ? 'cursor-grab' : 'cursor-pointer',
        isDragging && 'opacity-40',
      )}
    >
      <p className="line-clamp-3 text-[13px] leading-relaxed text-ink">{card.text || '…'}</p>
      {card.errorMessage ? (
        <p className="line-clamp-2 text-xs leading-relaxed text-state-failed">{card.errorMessage}</p>
      ) : null}
      <div className="flex items-center gap-2">
        {/* avatares dos canais empilhados */}
        <span className="flex -space-x-1.5">
          {card.items.slice(0, 4).map((item) => (
            <span key={item.id} className="relative">
              <Avatar className="size-6 border border-surface">
                {item.channel.avatarUrl ? <AvatarImage src={item.channel.avatarUrl} alt="" /> : null}
                <AvatarFallback className="text-[10px]">
                  {(item.channel.name ?? item.channel.provider).charAt(0)}
                </AvatarFallback>
              </Avatar>
              {PROVIDER_ICONS[item.channel.provider] ? (
                <img
                  src={PROVIDER_ICONS[item.channel.provider]}
                  alt=""
                  aria-hidden
                  className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-sm"
                />
              ) : null}
            </span>
          ))}
          {card.items.length > 4 ? (
            <span className="grid size-6 place-items-center rounded-full border border-surface bg-surface-2 text-[10px] font-semibold text-graphite">
              +{card.items.length - 4}
            </span>
          ) : null}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          {card.origin !== 'WEB' ? <Badge className="px-1.5 py-0.5">{card.origin}</Badge> : null}
          {when ? <span className="text-[11px] tabular-nums text-graphite">{when}</span> : null}
        </span>
      </div>
    </button>
  );
}

function KanbanColumn({
  id,
  accent,
  title,
  cards,
  onOpen,
}: {
  id: ColumnId;
  accent: string;
  title: string;
  cards: GroupCard[];
  onOpen: (groupId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${id}` });
  return (
    <section
      ref={setNodeRef}
      aria-label={title}
      className={cn(
        'flex min-h-64 w-72 shrink-0 flex-col gap-2 rounded-lg border border-line border-t-2 bg-surface-2 p-2 transition-colors duration-200 lg:w-auto lg:flex-1',
        accent,
        isOver && 'bg-accent-tint',
      )}
    >
      <h2 className="flex items-center justify-between px-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-graphite">
        {title}
        <span className="rounded-sm border border-line bg-surface px-1.5 tabular-nums">{cards.length}</span>
      </h2>
      {cards.map((card) => (
        <KanbanCard key={card.groupId} card={card} onOpen={onOpen} />
      ))}
    </section>
  );
}

/**
 * Kanban (SPEC_FRONTEND §3.2, design original): colunas por estado do grupo.
 * Arrastar Falhou → Agendado dispara o retry; transições inválidas explicam
 * no toast. Card abre o mesmo painel de detalhe do calendário.
 */
export function KanbanView() {
  const t = useTranslations('kanban');
  const errorMessage = useApiErrorMessage();
  const retry = useRetryPost();

  // janela: últimos 30 dias em diante (pipeline recente + tudo que está por vir)
  const [from] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  });
  const feed = usePublicationsFeed({ from });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  const cards = useMemo(() => {
    const byGroup = new Map<string, FeedItem[]>();
    for (const item of feed.data?.items ?? []) {
      const list = byGroup.get(item.groupId) ?? [];
      list.push(item);
      byGroup.set(item.groupId, list);
    }
    const out: GroupCard[] = [];
    for (const [groupId, items] of byGroup) {
      const first = items[0]!;
      const column = columnOf(first.group.state, first.group.awaitingApproval, items);
      if (!column) continue;
      out.push({
        groupId,
        state: first.group.state,
        awaitingApproval: first.group.awaitingApproval,
        origin: first.group.origin,
        publishAt: first.publishAt,
        text: first.text,
        items,
        errorMessage: items.find((i) => i.errorMessage)?.errorMessage ?? null,
        column,
      });
    }
    // mais recentes primeiro dentro da coluna
    return out.sort((a, b) => (b.publishAt ?? '').localeCompare(a.publishAt ?? ''));
  }, [feed.data]);

  const openItems = useMemo(
    () => cards.find((c) => c.groupId === openGroupId)?.items ?? [],
    [cards, openGroupId],
  );

  const onDragEnd = (event: DragEndEvent) => {
    const over = event.over?.id;
    const data = event.active.data.current as { column: ColumnId } | undefined;
    if (!over || typeof over !== 'string' || !data) return;
    const target = over.replace('col-', '') as ColumnId;
    if (target === data.column) return;
    if (data.column === 'failed' && target === 'scheduled') {
      retry.mutate(
        { groupId: String(event.active.id) },
        {
          onSuccess: () => toast.success(t('retryStarted')),
          onError: (err) => toast.error(errorMessage(err)),
        },
      );
      return;
    }
    toast.info(t('invalidMove'));
  };

  if (feed.isPending) {
    return (
      <div className="grid gap-3 lg:grid-cols-5">
        {COLUMNS.map((c) => (
          <Skeleton key={c.id} className="h-64 rounded-lg" />
        ))}
      </div>
    );
  }
  if (feed.isError) {
    return (
      <Alert variant="destructive">
        <CircleAlert aria-hidden />
        <AlertDescription className="flex flex-wrap items-center gap-3">
          {errorMessage(feed.error)}
          <Button variant="outline" size="sm" onClick={() => feed.refetch()}>
            {t('retry')}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line bg-surface-2 px-6 py-12 text-center">
        <p className="text-sm leading-relaxed text-graphite">{t('empty')}</p>
        <Button size="sm" className="mt-4" onClick={() => useComposerModal.getState().openComposer()}>
          {t('newPost')}
        </Button>
      </div>
    );
  }

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        {/* desktop: 5 colunas; mobile: rolagem horizontal (spec: empilha em 375px) */}
        <div className="flex gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-5 lg:overflow-visible">
          {COLUMNS.map(({ id, accent }) => (
            <KanbanColumn
              key={id}
              id={id}
              accent={accent}
              title={t(`columns.${id}`)}
              cards={cards.filter((c) => c.column === id)}
              onOpen={setOpenGroupId}
            />
          ))}
        </div>
      </DndContext>
      <PostDetailSheet groupId={openGroupId} items={openItems} onClose={() => setOpenGroupId(null)} />
    </>
  );
}
