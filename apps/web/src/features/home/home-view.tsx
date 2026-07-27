'use client';

import { PenSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { useMe } from '@/features/auth/hooks';
import { useCapabilities } from '@/features/billing/hooks';
import { useComposerModal } from '@/features/composer/use-composer-modal';
import {
  AttentionBlock,
  CalendarShortcut,
  FirstRunBlock,
  TodayBlock,
  UsageBlock,
  WeekBlock,
} from './home-blocks';
import { useInsightsSummary } from './hooks';
import { periodoDoDia, primeiroNome } from './logic';

/**
 * Tela inicial (SPEC home-operational-overview).
 *
 * Até aqui `/` era um `redirect` de seis linhas para `/calendario`: a primeira tela do produto era
 * uma ferramenta, não um panorama. O calendário responde "o que está agendado nesta semana", que é
 * uma boa pergunta e não é a **primeira**. A primeira é "está tudo bem?" — e a plataforma sabia a
 * resposta sem nunca oferecê-la.
 *
 * Composição: uma coluna principal com o que exige ação e o que sai hoje, e uma lateral com plano
 * e distribuição da semana (design.md §30 — right rail para conteúdo contextual, §37.3 para o
 * comportamento acima de 1200px). Nada aqui é métrica de desempenho: a plataforma não coleta
 * engajamento, então todo número vem do nosso registro do que foi pedido e do que foi entregue.
 */
export function HomeView() {
  const t = useTranslations('home');
  const resumo = useInsightsSummary();
  const me = useMe();
  const capabilities = useCapabilities();
  const openComposer = useComposerModal((s) => s.openComposer);

  const nome = primeiroNome(me.data?.user?.name);
  const saudacao = t(
    (
      {
        morning: 'greetingMorning',
        afternoon: 'greetingAfternoon',
        evening: 'greetingEvening',
      } as const
    )[periodoDoDia(new Date().getHours())],
  );

  const plano = capabilities.data?.plan;
  const ai = capabilities.data?.ai;
  // self-hosted não impõe limite: uma barra contra um teto que nunca será aplicado é ruído
  const mostrarPlano = plano?.enforced === true;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title={nome ? `${saudacao}, ${nome}` : saudacao}
        description={t('subtitle')}
        actions={
          <>
            <Button type="button" className="cursor-pointer gap-1.5" onClick={() => openComposer()}>
              <PenSquare className="size-3.5" aria-hidden />
              {t('newPost')}
            </Button>
            <CalendarShortcut />
          </>
        }
      />

      {resumo.isPending ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
          </div>
          <Skeleton className="h-56 rounded-lg" />
        </div>
      ) : resumo.isError || !resumo.data ? (
        <p role="alert" className="text-compact text-graphite">
          {t('loadError')}
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-4">
            {/* primeiro uso: a home É o onboarding, em vez de uma grade de zeros */}
            {resumo.data.firstRun ? (
              <FirstRunBlock step={resumo.data.firstRun} aiEnabled={ai?.enabled ?? false} />
            ) : (
              <>
                {/* ausente quando nada está errado — silêncio é a mensagem (design.md §3.3) */}
                <AttentionBlock attention={resumo.data.attention} />
                <TodayBlock today={resumo.data.today} />
              </>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            {mostrarPlano && plano ? (
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
              />
            ) : null}
            {resumo.data.firstRun ? null : <WeekBlock week={resumo.data.week} />}
          </div>
        </div>
      )}
    </div>
  );
}
