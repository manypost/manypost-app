'use client';

import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { CircleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useComposerModal } from '@/features/composer/use-composer-modal';
import { useDuplicatePost } from '@/features/composer/use-duplicate';
import { useCancelPost, useReschedulePost, useRetryPost } from '@/features/publications/hooks';
import { PostDetailSheet } from '@/features/publications/post-detail-sheet';
import { useApiErrorMessage } from '@/lib/api/errors';
import { cn } from '@/lib/utils';
import { BulkBar } from './bulk-bar';
import { usePipelineFeed, TETO_DO_QUADRO } from './hooks';
import { KanbanCard } from './kanban-card';
import { CancelDropZone, KanbanColumn } from './kanban-column';
import { JANELAS, KanbanFilters, type EstadoDosFiltros, type Janela } from './kanban-filters';
import {
  agruparEmCards,
  aplicarFiltros,
  COLUNAS,
  intervaloDeSelecao,
  ordenarCards,
  transicaoPermitida,
  type AcaoDoCard,
  type ColumnId,
  type DropTarget,
  type GroupCard,
} from './logic';
import { useKanbanPrefs } from './use-kanban-prefs';

const csv = (v: string | null): string[] => (v ? v.split(',').filter(Boolean) : []);

/**
 * Quadro (SPEC kanban-board-operations).
 *
 * Duas coisas que este arquivo faz de propósito e que o anterior não fazia:
 *
 *  - **Lê a janela inteira.** `usePipelineFeed` segue o cursor; e quando nem assim couber, o quadro
 *    diz que truncou em vez de mostrar uma coluna vazia que não é vazia.
 *  - **Recusa explicando.** Cada transição inválida devolve um motivo, e o motivo vira a oferta da
 *    operação que funciona — porque em dois dos três casos a pessoa quer algo legítimo que só tem
 *    outro caminho.
 */
export function KanbanBoard() {
  const t = useTranslations('kanban');
  const errorMessage = useApiErrorMessage();
  const router = useRouter();
  const params = useSearchParams();
  const openComposer = useComposerModal((s) => s.openComposer);
  const { densidade } = useKanbanPrefs();
  const { duplicate, dialog: duplicateDialog } = useDuplicatePost();

  const retry = useRetryPost();
  const cancel = useCancelPost();
  const reschedule = useReschedulePost();

  // --- filtros: a URL é a fonte da verdade, para o quadro estreitado caber num link
  const filtros: EstadoDosFiltros = useMemo(() => {
    const janela = Number(params.get('dias'));
    return {
      colunas: csv(params.get('col')) as ColumnId[],
      canais: csv(params.get('canal')),
      busca: params.get('q') ?? '',
      janela: (JANELAS as readonly number[]).includes(janela) ? (janela as Janela) : 30,
    };
  }, [params]);

  const escreverFiltros = useCallback(
    (parcial: Partial<EstadoDosFiltros>) => {
      const proximo = { ...filtros, ...parcial };
      const sp = new URLSearchParams();
      if (proximo.colunas.length) sp.set('col', proximo.colunas.join(','));
      if (proximo.canais.length) sp.set('canal', proximo.canais.join(','));
      if (proximo.busca.trim()) sp.set('q', proximo.busca);
      if (proximo.janela !== 30) sp.set('dias', String(proximo.janela));
      const qs = sp.toString();
      // replace: filtrar não é navegar, não deve encher o histórico
      router.replace(qs ? `/kanban?${qs}` : '/kanban', { scroll: false });
    },
    [filtros, router],
  );

  const feed = usePipelineFeed(filtros.janela, { refetchInterval: 30_000 });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const [openGroupId, setOpenGroupId] = useState<string | null>(() => params.get('post'));
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [ancora, setAncora] = useState<string | null>(null);

  const todos = useMemo(() => ordenarCards(agruparEmCards(feed.data?.items ?? [])), [feed.data]);
  const cards = useMemo(() => aplicarFiltros(todos, filtros), [todos, filtros]);

  const porColuna = useMemo(() => {
    const m = new Map<ColumnId, GroupCard[]>(COLUNAS.map((c) => [c.id, []]));
    for (const c of cards) m.get(c.column)!.push(c);
    return m;
  }, [cards]);

  const openItems = useMemo(
    () => todos.find((c) => c.groupId === openGroupId)?.items ?? [],
    [todos, openGroupId],
  );

  const cardArrastado = useMemo(
    () => (arrastando ? cards.find((c) => c.groupId === arrastando) ?? null : null),
    [arrastando, cards],
  );

  const selecionadosCards = useMemo(
    () => cards.filter((c) => selecionados.includes(c.groupId)),
    [cards, selecionados],
  );

  // --- seleção
  const alternarSelecao = (groupId: string, faixa: boolean) => {
    const ids = cards.map((c) => c.groupId);
    if (faixa && ancora) {
      const trecho = intervaloDeSelecao(ids, ancora, groupId);
      setSelecionados((atual) => Array.from(new Set([...atual, ...trecho])));
      return;
    }
    setAncora(groupId);
    setSelecionados((atual) =>
      atual.includes(groupId) ? atual.filter((id) => id !== groupId) : [...atual, groupId],
    );
  };

  // --- ações do menu do card
  const [confirmar, setConfirmar] = useState<{ acao: 'cancel' | 'publishNow'; card: GroupCard } | null>(
    null,
  );

  const executarAcao = (acao: AcaoDoCard, card: GroupCard) => {
    if (acao === 'open') return setOpenGroupId(card.groupId);
    if (acao === 'duplicate') return duplicate(card.groupId);
    if (acao === 'retry') {
      retry.mutate(
        { groupId: card.groupId },
        {
          onSuccess: () => toast.success(t('retryStarted')),
          onError: (err) => toast.error(errorMessage(err)),
        },
      );
      return;
    }
    // o link em si não é legível de volta (o token é guardado com hash), então a ação honesta é
    // levar ao painel que cria, copia e revoga — não prometer uma cópia que a API não devolve
    if (acao === 'approvalLink') return setOpenGroupId(card.groupId);
    setConfirmar({ acao, card });
  };

  const confirmarAcao = () => {
    if (!confirmar) return;
    const { acao, card } = confirmar;
    setConfirmar(null);
    if (acao === 'cancel') {
      cancel.mutate(card.groupId, {
        onSuccess: () => toast.success(t('cancelled')),
        onError: (err) => toast.error(errorMessage(err)),
      });
      return;
    }
    reschedule.mutate(
      { groupId: card.groupId, publishAt: new Date().toISOString() },
      {
        onSuccess: () => toast.success(t('publishNowStarted')),
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  // --- arraste
  const onDragEnd = (event: DragEndEvent) => {
    setArrastando(null);
    const over = event.over?.id;
    const data = event.active.data.current as { column: ColumnId } | undefined;
    if (!over || typeof over !== 'string' || !data) return;

    const alvo = over.replace('col-', '') as DropTarget;
    const groupId = String(event.active.id);
    const transicao = transicaoPermitida(data.column, alvo);

    if (transicao.tipo === 'nenhuma') return;

    if (transicao.tipo === 'retry') {
      retry.mutate(
        { groupId },
        {
          onSuccess: () => toast.success(t('retryStarted')),
          onError: (err) => toast.error(errorMessage(err)),
        },
      );
      return;
    }

    if (transicao.tipo === 'cancel') {
      const card = cards.find((c) => c.groupId === groupId);
      if (card) setConfirmar({ acao: 'cancel', card });
      return;
    }

    // recusa: o motivo vira a oferta da operação que funciona
    const motivo = transicao.motivo;
    if (motivo === 'approvalOnly') {
      toast.info(t(`refusals.${motivo}`), {
        action: { label: t('refusalActions.approvalOnly'), onClick: () => setOpenGroupId(groupId) },
      });
      return;
    }
    if (motivo === 'draftNotSchedulable') {
      toast.info(t(`refusals.${motivo}`), {
        action: { label: t('refusalActions.draftNotSchedulable'), onClick: () => duplicate(groupId) },
      });
      return;
    }
    if (motivo === 'publishNeedsConfirmation') {
      toast.info(t(`refusals.${motivo}`), {
        action: { label: t('refusalActions.publishNeedsConfirmation'), onClick: () => setOpenGroupId(groupId) },
      });
      return;
    }
    toast.info(t(`refusals.${motivo}`));
  };

  const onDragStart = (event: DragStartEvent) => setArrastando(String(event.active.id));

  // --- saídas
  if (feed.isPending) {
    return (
      <div className="grid gap-3 lg:grid-cols-5">
        {COLUNAS.map((c) => (
          <Skeleton key={c.id} className="h-64 rounded-card" />
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
          <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => feed.refetch()}>
            {t('retry')}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const temFiltro =
    filtros.colunas.length > 0 || filtros.canais.length > 0 || filtros.busca.trim().length > 0;

  return (
    <div className="flex flex-col overflow-clip rounded-card border border-line bg-surface">
      <KanbanFilters
        estado={filtros}
        onChange={escreverFiltros}
        onLimpar={() => router.replace('/kanban', { scroll: false })}
      />

      {feed.data?.truncado ? (
        <p role="status" className="m-3 rounded-control border border-line bg-surface-2 px-3 py-2 text-meta text-graphite">
          {t('truncated', { count: TETO_DO_QUADRO })}
        </p>
      ) : null}

      {todos.length === 0 ? (
        <div className="m-3 rounded-card bg-surface-2 px-6 py-12 text-center">
          <p className="text-compact leading-relaxed text-graphite">{t('empty')}</p>
          <Button size="sm" className="mt-4 cursor-pointer" onClick={() => openComposer()}>
            {t('newPost')}
          </Button>
        </div>
      ) : cards.length === 0 && temFiltro ? (
        // vazio POR FILTRO é diferente de pipeline vazio — dizer o contrário faria a tela mentir
        <div className="m-3 rounded-card bg-surface-2 px-6 py-12 text-center">
          <p className="text-compact leading-relaxed text-graphite">{t('filteredEmpty')}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 cursor-pointer"
            onClick={() => router.replace('/kanban', { scroll: false })}
          >
            {t('filters.clear')}
          </Button>
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <CancelDropZone ativo={arrastando !== null} />
          {/* desktop: 5 colunas; mobile: rolagem horizontal */}
          <div className="flex overflow-x-auto pb-3 lg:grid lg:grid-cols-5 lg:overflow-visible">
            {COLUNAS.map(({ id, accent }) => (
              <KanbanColumn
                key={id}
                id={id}
                accent={accent}
                title={t(`columns.${id}`)}
                count={porColuna.get(id)!.length}
                compacta={densidade === 'compacta'}
              >
                {porColuna.get(id)!.map((card) => (
                  <KanbanCard
                    key={card.groupId}
                    card={card}
                    densidade={densidade}
                    selecionado={selecionados.includes(card.groupId)}
                    temSelecao={selecionados.length > 0}
                    onOpen={setOpenGroupId}
                    onToggle={alternarSelecao}
                    onAcao={executarAcao}
                  />
                ))}
              </KanbanColumn>
            ))}
          </div>
          <DragOverlay>
            {cardArrastado ? (
              <div className="w-72 rounded-card border border-accent bg-surface p-3">
                <p className="line-clamp-3 text-compact leading-relaxed text-ink">
                  {cardArrastado.text || '…'}
                </p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <BulkBar
        selecionados={selecionadosCards}
        onLimpar={() => {
          setSelecionados([]);
          setAncora(null);
        }}
      />

      <PostDetailSheet
        groupId={openGroupId}
        items={openItems}
        onClose={() => {
          setOpenGroupId(null);
          const proximos = new URLSearchParams(params.toString());
          proximos.delete('post');
          const query = proximos.toString();
          router.replace(query ? `/kanban?${query}` : '/kanban', { scroll: false });
        }}
      />
      {duplicateDialog}
      <ConfirmarAcao
        pendente={confirmar}
        onCancelar={() => setConfirmar(null)}
        onConfirmar={confirmarAcao}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
/** publicar agora e cancelar são irreversíveis: nunca acontecem sem uma segunda intenção */
function ConfirmarAcao({
  pendente,
  onCancelar,
  onConfirmar,
}: {
  pendente: { acao: 'cancel' | 'publishNow'; card: GroupCard } | null;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  const t = useTranslations('kanban');
  if (!pendente) return null;
  const destrutivo = pendente.acao === 'cancel';
  return (
    <AlertDialog open onOpenChange={(aberto) => !aberto && onCancelar()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{destrutivo ? t('cancelTitle') : t('publishNowTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {destrutivo ? t('cancelBody') : t('publishNowBody')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="cursor-pointer">{t('actions.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            className={cn('cursor-pointer', destrutivo && 'border-destructive bg-destructive text-paper')}
            onClick={onConfirmar}
          >
            {destrutivo ? t('cancelConfirm') : t('publishNowConfirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
