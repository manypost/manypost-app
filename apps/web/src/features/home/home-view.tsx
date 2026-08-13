'use client';

import { PenSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { useMe } from '@/features/auth/hooks';
import { useCapabilities } from '@/features/billing/hooks';
import { useComposerStore } from '@/features/composer/store';
import { useComposerModal } from '@/features/composer/use-composer-modal';
import { useDuplicatePost } from '@/features/composer/use-duplicate';
import { usePipelineFeed } from '@/features/kanban/hooks';
import { agruparEmCards, ordenarCards } from '@/features/kanban/logic';
import { useNotifications } from '@/features/notifications/hooks';
import { PostDetailSheet } from '@/features/publications/post-detail-sheet';
import {
  AttentionBlock,
  CalendarShortcut,
  FirstRunBlock,
  TodayBlock,
  UsageBlock,
  WeekBlock,
} from './home-blocks';
import {
  ActivityBlock,
  BlocoAssincrono,
  DraftsBlock,
  NextActionBlock,
  PipelineBlock,
  UpcomingBlock,
} from './home-blocks-operational';
import { useDraftGroups, useInsightsSummary, useUpcomingPublications } from './hooks';
import {
  atividadeRecente,
  medidor,
  ordemDosBlocos,
  periodoDoDia,
  primeiroNome,
  proximaAcao,
  resumoDoRascunhoLocal,
  type BlocoId,
  type EstadoDeFonte,
  type EstadoDaHome,
} from './logic';

const estadoDaFonte = (isPending: boolean, isError: boolean, hasContent: boolean): EstadoDeFonte => {
  if (isPending) return 'pending';
  if (isError) return 'error';
  return hasContent ? 'ready' : 'empty';
};

/**
 * Tela inicial (SPEC home-operational-overview).
 *
 * A v1 respondia bem a uma pergunta — "está tudo bem?" — e parava aí. A v2 responde também "o que
 * acontece agora?", "o que mudou desde ontem?" e "qual é o próximo passo?", **sem** virar analytics:
 * a plataforma não coleta engajamento, então todo número continua vindo do registro do que ela
 * pediu e do que entregou.
 *
 * Três decisões estruturais:
 *
 *  1. **A ordem dos blocos é dado** (`ordemDosBlocos`), não JSX. Bloco vazio não entra na lista, e
 *     a coluna única do celular é outra lista em vez de `order-*` espalhado.
 *  2. **Cada bloco falha sozinho.** Antes, `resumo.isError` derrubava a tela inteira — inclusive as
 *     partes alimentadas por outra fonte. Agora o erro é do bloco.
 *  3. **O pipeline compartilha a consulta do quadro**, então as duas telas não podem discordar.
 */
export function HomeView() {
  const t = useTranslations('home');
  const resumo = useInsightsSummary();
  const me = useMe();
  const capabilities = useCapabilities();
  const openComposer = useComposerModal((s) => s.openComposer);
  const { duplicate, dialog: duplicateDialog } = useDuplicatePost();

  const upcoming = useUpcomingPublications();
  const drafts = useDraftGroups();
  const notifications = useNotifications();
  const pipeline = usePipelineFeed(30, { refetchInterval: 60_000 });

  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    const intervalo = setInterval(() => setAgora(new Date()), 60_000);
    return () => clearInterval(intervalo);
  }, []);

  const nome = primeiroNome(me.data?.user?.name);
  const saudacao = t(
    (
      {
        morning: 'greetingMorning',
        afternoon: 'greetingAfternoon',
        evening: 'greetingEvening',
      } as const
    )[periodoDoDia(agora.getHours())],
  );

  const plano = capabilities.data?.plan;
  const ai = capabilities.data?.ai;
  // self-hosted não impõe limite: uma barra contra um teto que nunca será aplicado é ruído
  const mostrarPlano = plano?.enforced === true;

  const cardsDoPipeline = useMemo(
    () => ordenarCards(agruparEmCards(pipeline.data?.items ?? [])),
    [pipeline.data],
  );

  const rascunhoLocal = useComposerStore((s) =>
    resumoDoRascunhoLocal({
      text: s.text,
      overrides: s.overrides,
      channelSettings: s.channelSettings,
      thread: s.thread,
      mediaIds: s.mediaIds,
      contentUpdatedAt: s.contentUpdatedAt,
    }),
  );

  const atividade = useMemo(
    () => atividadeRecente(pipeline.data?.items ?? [], notifications.data ?? [], agora),
    [pipeline.data, notifications.data, agora],
  );

  const estado: EstadoDaHome | null = resumo.data
    ? {
        firstRun: resumo.data.firstRun,
        atencao: resumo.data.attention,
        week: resumo.data.week,
        proximas: upcoming.data ?? [],
        rascunhosServidor: drafts.data ?? [],
        rascunhoLocal,
        planoNoLimite: mostrarPlano
          ? medidor(plano!.usage.postsThisMonth, plano!.limits.postsPerMonth).atLimit
          : false,
        mostrarPlano,
        atividade,
        pipelineTemAlgo: cardsDoPipeline.length > 0,
        agora,
      }
    : null;

  const fontes = {
    upcoming: estadoDaFonte(upcoming.isPending, upcoming.isError, (upcoming.data?.length ?? 0) > 0),
    drafts: estadoDaFonte(
      drafts.isPending,
      drafts.isError,
      Boolean(rascunhoLocal) || (drafts.data?.length ?? 0) > 0,
    ),
    pipeline: estadoDaFonte(pipeline.isPending, pipeline.isError, cardsDoPipeline.length > 0),
    activity: estadoDaFonte(
      pipeline.isPending || notifications.isPending,
      pipeline.isError || notifications.isError,
      atividade.length > 0,
    ),
  } as const;

  const ordem = ordemDosBlocos(estado, fontes);
  const atividadeSemConteudo = atividade.length === 0;
  const atividadePendente = pipeline.isPending || notifications.isPending;
  const atividadeComErro = pipeline.isError || notifications.isError;
  const atividadeIncompleta = !atividadeSemConteudo && atividadeComErro;

  const abrirAprovacao = (groupId: string) => {
    setOpenGroupId(groupId);
    toast.info(t('draftsApproval'));
  };

  const itensAbertos = useMemo(() => {
    const doPipeline = cardsDoPipeline.find((c) => c.groupId === openGroupId)?.items;
    if (doPipeline) return doPipeline;
    const fontes = [...(upcoming.data ?? []), ...(drafts.data ?? [])];
    return fontes.filter((i) => i.groupId === openGroupId);
  }, [cardsDoPipeline, openGroupId, upcoming.data, drafts.data]);

  const bloco = (id: BlocoId): React.ReactNode => {
    const envolver = (node: React.ReactNode) =>
      node ? (
        <div key={id} className="contents">
          {node}
        </div>
      ) : null;

    switch (id) {
      case 'firstRun':
        return resumo.data?.firstRun
          ? envolver(
              <FirstRunBlock step={resumo.data.firstRun} aiEnabled={ai?.enabled ?? false} />,
            )
          : null;
      case 'attention':
        return estado ? envolver(<AttentionBlock attention={estado.atencao} />) : null;
      case 'nextAction':
        return estado ? envolver(<NextActionBlock acao={proximaAcao(estado)} />) : null;
      case 'upcoming':
        return envolver(
          <BlocoAssincrono
            titulo={t('upcomingTitle')}
            isPending={upcoming.isPending}
            isError={upcoming.isError}
            onRetry={() => upcoming.refetch()}
          >
            <UpcomingBlock items={upcoming.data ?? []} onOpen={setOpenGroupId} />
          </BlocoAssincrono>,
        );
      case 'pipeline':
        return envolver(
          <BlocoAssincrono
            titulo={t('pipelineTitle')}
            isPending={pipeline.isPending}
            isError={pipeline.isError}
            onRetry={() => pipeline.refetch()}
          >
            <PipelineBlock cards={cardsDoPipeline} truncado={pipeline.data?.truncado ?? false} />
          </BlocoAssincrono>,
        );
      case 'drafts':
        return envolver(
          <DraftsBlock
            local={rascunhoLocal}
            servidor={drafts.data ?? []}
            serverPending={drafts.isPending}
            serverError={drafts.isError}
            onRetryServer={() => drafts.refetch()}
            onResumeLocal={() => openComposer()}
            onDuplicate={duplicate}
            onApproval={abrirAprovacao}
          />,
        );
      case 'week':
        return resumo.data ? envolver(<WeekBlock week={resumo.data.week} />) : null;
      case 'activity':
        return envolver(
          <BlocoAssincrono
            titulo={t('activityTitle')}
            isPending={atividadeSemConteudo && atividadePendente}
            isError={atividadeSemConteudo && atividadeComErro}
            onRetry={() => {
              void pipeline.refetch();
              void notifications.refetch();
            }}
          >
            <ActivityBlock
              entradas={atividade}
              agora={agora}
              onOpen={setOpenGroupId}
              incompleta={atividadeIncompleta}
              onRetry={() => {
                void pipeline.refetch();
                void notifications.refetch();
              }}
            />
          </BlocoAssincrono>,
        );
      case 'usage':
        return plano
          ? envolver(
              <UsageBlock
                usage={{
                  postsThisMonth: plano.usage.postsThisMonth,
                  channels: plano.usage.channels,
                }}
                limits={{
                  postsPerMonth: plano.limits.postsPerMonth,
                  channels: plano.limits.channels,
                }}
                aiCredits={
                  ai?.credits?.enforced
                    ? { remaining: ai.credits.remaining, granted: ai.credits.granted }
                    : null
                }
              />,
            )
          : null;
    }
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader
        title={nome ? `${saudacao}, ${nome}` : saudacao}
        description={t('subtitle')}
        actions={
          <>
            <Button
              type="button"
              className="cursor-pointer gap-2 text-paper"
              onClick={() => openComposer()}
            >
              <PenSquare className="size-3.5" aria-hidden />
              {t('newPost')}
            </Button>
            <CalendarShortcut />
          </>
        }
      />

      {resumo.isPending ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3" aria-hidden>
          <Skeleton className="h-32 rounded-kpi" />
          <Skeleton className="h-32 rounded-kpi" />
          <Skeleton className="h-32 rounded-kpi" />
        </div>
      ) : resumo.data && !resumo.data.firstRun ? (
        <TodayBlock today={resumo.data.today} />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="flex min-w-0 flex-col gap-6">
          {resumo.isPending || resumo.isError ? (
            <BlocoAssincrono
              titulo={t('title')}
              isPending={resumo.isPending}
              isError={resumo.isError}
              onRetry={() => resumo.refetch()}
            >
              {null}
            </BlocoAssincrono>
          ) : null}
          {ordem.principal.map((id) => bloco(id))}
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          {ordem.lateral.map((id) => bloco(id))}
        </div>
      </div>

      <PostDetailSheet
        groupId={openGroupId}
        items={itensAbertos}
        onClose={() => setOpenGroupId(null)}
      />
      {duplicateDialog}
    </div>
  );
}
