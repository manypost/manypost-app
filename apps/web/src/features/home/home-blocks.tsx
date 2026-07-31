'use client';

import {
  CalendarDays,
  Plug,
  PenSquare,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { InsightsSummary } from './hooks';
import { diasVazios, linhasDeAtencao, medidor, type AttentionRow } from './logic';

/**
 * Blocos da tela inicial.
 *
 * Duas regras valem para todos, e são de honestidade, não de estilo:
 *
 *  1. **Bloco sem conteúdo não existe.** O bloco de atenção desaparece quando nada está errado —
 *     não vira um cartão verde de "tudo em ordem" (design.md §3.3: um sinal dominante por região,
 *     e silêncio também é sinal). O de plano desaparece onde o limite não é imposto.
 *  2. **Nenhum número aqui é de desempenho.** A plataforma não coleta engajamento, então tudo o
 *     que aparece vem do nosso registro do que foi pedido e do que foi entregue.
 *
 * Visual: superfície chapada (fill branco + borda 1px), zero sombra, raio 8px, e a escala
 * tipográfica nomeada do §6.3 — nunca valor arbitrário.
 */

/** Moldura comum dos cartões — superfície que "sobe", sem sombra (adendo design.md §51.4) */
export function Card({
  title,
  children,
  action,
  tone = 'neutral',
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  tone?: 'neutral' | 'alert';
}) {
  return (
    <section
      className={cn(
        'flex flex-col gap-3 rounded-lg border bg-surface p-4 sm:p-5',
        tone === 'alert' ? 'border-state-failed' : 'border-line',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          className={cn(
            'flex items-center gap-2 text-compact font-semibold',
            tone === 'alert' ? 'text-state-failed' : 'text-ink',
          )}
        >
          {tone === 'alert' ? <TriangleAlert className="size-4 shrink-0" aria-hidden /> : null}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------

/**
 * "Precisa de atenção" — a resposta para "está tudo bem?".
 *
 * Retorna `null` quando não há nada. Era o buraco central do produto: uma publicação que falhou
 * de madrugada era um cartão vermelho no kanban, *se* a pessoa pensasse em ir lá, e um canal com
 * token expirado só aparecia em `/conexoes` — então o jeito normal de descobrir era um post
 * falhando.
 */
export function AttentionBlock({ attention }: { attention: InsightsSummary['attention'] }) {
  const t = useTranslations('home');
  const linhas = linhasDeAtencao(attention);
  if (linhas.length === 0) return null;

  const textoDaLinha = (l: AttentionRow) => {
    if (l.kind === 'channel') {
      const nome = l.channel?.name ?? l.channel?.provider ?? '';
      return l.channel?.status === 'REFRESH_REQUIRED'
        ? t('attentionChannel', { name: nome })
        : t('attentionChannelGeneric', { name: nome });
    }
    const chave = {
      failed: 'attentionFailed',
      needsReview: 'attentionNeedsReview',
      awaitingApproval: 'attentionAwaitingApproval',
      partial: 'attentionPartial',
    } as const;
    return t(chave[l.kind], { count: l.count });
  };

  const ctaDaLinha = (l: AttentionRow) =>
    ({
      failed: t('goToFailed'),
      channel: t('goToChannels'),
      partial: t('goToPartial'),
      needsReview: t('goToReview'),
      awaitingApproval: t('goToApproval'),
    })[l.kind];

  return (
    <Card title={t('attentionTitle')} tone="alert">
      <ul className="flex flex-col divide-y divide-line">
        {linhas.map((l, i) => {
          return (
            <li
              key={`${l.kind}-${l.channel?.channelId ?? i}`}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 py-2 first:pt-0 last:pb-0"
            >
              <span className="min-w-0 truncate text-compact text-ink">{textoDaLinha(l)}</span>
              <Button asChild size="sm" variant="outline" className="h-7 shrink-0 cursor-pointer px-2.5 text-meta">
                <Link href={l.href}>{ctaDaLinha(l)}</Link>
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ---------------------------------------------------------------------------

/** "Sai hoje" — a segunda pergunta da manhã, depois de "está tudo bem?" */
export function TodayBlock({ today }: { today: InsightsSummary['today'] }) {
  const t = useTranslations('home');
  const nada = today.scheduled === 0 && today.published === 0 && today.failed === 0;

  return (
    <Card
      title={t('todayTitle')}
      action={
        <Button asChild size="sm" variant="ghost" className="h-7 cursor-pointer px-2 text-meta">
          <Link href="/calendario">{t('openCalendar')}</Link>
        </Button>
      }
    >
      {nada ? (
        <div className="flex flex-col items-start gap-2.5">
          <p className="text-compact text-graphite">{t('todayEmpty')}</p>
          <Button asChild size="sm" className="cursor-pointer">
            <Link href="/compor">{t('todayEmptyCta')}</Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <p className="flex items-baseline gap-2">
            <span className="text-figure font-medium tabular-nums tracking-[-0.02em] text-ink">
              {today.scheduled}
            </span>
            <span className="text-compact text-graphite">{t('todayScheduled', { count: today.scheduled })}</span>
          </p>
          {today.published > 0 ? (
            <p className="text-compact text-graphite">
              {t('todayPublished', { count: today.published })}
            </p>
          ) : null}
          {today.failed > 0 ? (
            <Link
              href="/kanban"
              className="text-compact font-semibold text-state-failed underline-offset-2 hover:underline"
            >
              {t('todayFailed', { count: today.failed })}
            </Link>
          ) : null}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------

/** Uma barra de uso. `--data-*` são os tokens de série analítica do adendo design.md §51.6. */
function Meter({
  label,
  used,
  limit,
  unlimitedLabel,
  ofLabel,
}: {
  label: string;
  used: number;
  limit: number;
  unlimitedLabel: string;
  ofLabel: (used: number, limit: number) => string;
}) {
  const m = medidor(used, limit);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-meta font-medium text-graphite">{label}</span>
        <span
          className={cn(
            'text-compact font-semibold tabular-nums',
            m.atLimit ? 'text-state-failed' : m.nearLimit ? 'text-state-review' : 'text-ink',
          )}
        >
          {m.unlimited ? unlimitedLabel : ofLabel(m.used, m.limit)}
        </span>
      </div>
      {m.unlimited ? null : (
        <div className="h-1.5 overflow-hidden rounded-sm bg-data-track" role="presentation">
          <div
            className={cn(
              'h-full rounded-sm transition-[width] duration-200',
              m.atLimit ? 'bg-state-failed' : m.nearLimit ? 'bg-state-review' : 'bg-data-1',
            )}
            style={{ width: `${m.pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * "Seu plano" — uso contra limite.
 *
 * Ausente quando a instalação não impõe limite (self-hosted): mostrar uma barra contra um teto que
 * nunca será aplicado é ruído, não informação.
 */
export function UsageBlock({
  usage,
  limits,
  aiCredits,
}: {
  usage: { postsThisMonth: number; channels: number };
  limits: { postsPerMonth: number; channels: number };
  aiCredits: { remaining: number; granted: number } | null;
}) {
  const t = useTranslations('home');
  const posts = medidor(usage.postsThisMonth, limits.postsPerMonth);
  const canais = medidor(usage.channels, limits.channels);
  const avisar = posts.nearLimit || posts.atLimit || canais.nearLimit || canais.atLimit;
  const ofLabel = (used: number, limit: number) => t('usageOf', { used, limit });

  return (
    <Card
      title={t('usageTitle')}
      action={
        <Button asChild size="sm" variant="ghost" className="h-7 cursor-pointer px-2 text-meta">
          <Link href="/planos">{t('seePlans')}</Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-3.5">
        <Meter
          label={t('usagePosts')}
          used={usage.postsThisMonth}
          limit={limits.postsPerMonth}
          unlimitedLabel={t('usageUnlimited')}
          ofLabel={ofLabel}
        />
        <Meter
          label={t('usageChannels')}
          used={usage.channels}
          limit={limits.channels}
          unlimitedLabel={t('usageUnlimited')}
          ofLabel={ofLabel}
        />
        {aiCredits && aiCredits.granted > 0 ? (
          <Meter
            label={t('usageAiCredits')}
            used={aiCredits.granted - aiCredits.remaining}
            limit={aiCredits.granted}
            unlimitedLabel={t('usageUnlimited')}
            ofLabel={ofLabel}
          />
        ) : null}
        {avisar ? (
          <p className="text-meta leading-relaxed text-state-review">{t('usageNearLimit')}</p>
        ) : null}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------

const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/**
 * "Próximos 7 dias" — a distribuição, não um gráfico.
 *
 * São microbarras (design.md §29.5) sobre contagem própria; nenhuma métrica de desempenho entra
 * aqui, porque não existe. O que a tela oferece é a leitura útil que o calendário não dá de
 * relance: **onde estão os buracos**.
 */
export function WeekBlock({ week }: { week: InsightsSummary['week'] }) {
  const t = useTranslations('home');
  const vazios = diasVazios(week.byDay);
  const pico = Math.max(1, ...week.byDay);
  const hojeIdx = new Date().getDay();

  return (
    <Card
      title={t('weekTitle')}
      action={
        <span className="text-meta tabular-nums text-graphite">
          {t('weekTotal', { count: week.scheduled })}
        </span>
      }
    >
      {week.scheduled === 0 ? (
        <p className="text-compact text-graphite">{t('weekNothing')}</p>
      ) : (
        <>
          <ul className="flex items-end justify-between gap-1.5">
            {week.byDay.map((n, i) => (
              <li key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <span className="text-meta tabular-nums text-graphite">{n > 0 ? n : ''}</span>
                <div className="flex h-14 w-full items-end">
                  <div
                    className={cn(
                      'w-full rounded-sm',
                      n === 0 ? 'bg-data-track' : 'bg-data-1',
                    )}
                    style={{ height: n === 0 ? '3px' : `${Math.max(12, (n / pico) * 100)}%` }}
                  />
                </div>
                <span className="text-meta text-graphite">
                  {DIAS_CURTOS[(hojeIdx + i) % 7]}
                </span>
              </li>
            ))}
          </ul>
          {vazios > 0 ? (
            <p className="text-meta text-graphite">{t('weekEmptyDays', { count: vazios })}</p>
          ) : null}
        </>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------

/**
 * Primeiro uso: próximos passos em vez de uma grade de zeros.
 *
 * A home É o onboarding de produto. Uma organização recém-criada não tem nada a operar, e mostrar
 * seis contadores em zero comunica "este produto está vazio" em vez de "comece aqui".
 */
export function FirstRunBlock({
  step,
  aiEnabled,
}: {
  step: 'no_channels' | 'no_posts';
  aiEnabled: boolean;
}) {
  const t = useTranslations('home');

  const passos =
    step === 'no_channels'
      ? [
          {
            icon: Plug,
            title: t('firstRunConnectTitle'),
            body: t('firstRunConnectBody'),
            cta: { href: '/conexoes', label: t('firstRunConnectCta') },
          },
        ]
      : [
          {
            icon: PenSquare,
            title: t('firstRunComposeTitle'),
            body: t('firstRunComposeBody'),
            cta: { href: '/compor', label: t('firstRunComposeCta') },
          },
          ...(aiEnabled
            ? [
                {
                  icon: Sparkles,
                  title: t('firstRunAiTitle'),
                  body: t('firstRunAiBody'),
                  cta: null,
                },
              ]
            : []),
        ];

  return (
    <Card title={t('firstRunTitle')}>
      <ol className="flex flex-col gap-4">
        {passos.map((p) => (
          <li key={p.title} className="flex items-start gap-3">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-accent-tint">
              <p.icon className="size-3.5 text-accent" aria-hidden />
            </span>
            <div className="flex min-w-0 flex-col items-start gap-1.5">
              <p className="text-compact font-semibold text-ink">{p.title}</p>
              <p className="max-w-reading text-compact leading-relaxed text-graphite">{p.body}</p>
              {p.cta ? (
                <Button asChild size="sm" className="mt-0.5 cursor-pointer">
                  <Link href={p.cta.href}>{p.cta.label}</Link>
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

// ---------------------------------------------------------------------------

/** atalho para o calendário quando não há primeiro passo nem nada errado */
export function CalendarShortcut() {
  const t = useTranslations('home');
  return (
    <Button asChild variant="outline" size="sm" className="cursor-pointer gap-1.5">
      <Link href="/calendario">
        <CalendarDays className="size-3.5" aria-hidden />
        {t('openCalendar')}
      </Link>
    </Button>
  );
}
