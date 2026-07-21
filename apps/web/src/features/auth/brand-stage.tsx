'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { ProviderIcon } from '@/features/channels/provider-icon';
import { cn } from '@/lib/utils';
import { AUTH_NETWORKS } from './networks';
import { GithubIcon } from './social-icons';

const AUTOPLAY_MS = 6000;

/**
 * Palco da marca no "momento dark" (BRAND §3 --night): um carrossel de
 * destaques do produto que ocupa toda a largura do painel (inspirado no uso de
 * tela do Postiz — docs/references for postiz/login.png). Cada slide é desenhado
 * só com materiais do design system (tiles reais, hairlines, tokens de estado;
 * zero sombra). Auto-avança, pausa no hover/foco e respeita
 * prefers-reduced-motion (sem autoplay, sem transição). "Sem translate no hover"
 * (BRAND §2.3) segue valendo — o translate aqui é do trilho, nunca de hover.
 */
export function BrandStage() {
  const t = useTranslations('auth');
  const slidesData = [
    { key: 'code' },
    { key: 'week' },
    { key: 'flow' },
  ];
  const count = slidesData.length;

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);

  useEffect(() => {
    if (paused || reduced) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [paused, reduced, count]);

  return (
    <div className="auth-grid relative flex flex-1 flex-col justify-center gap-9 overflow-hidden bg-night px-12 py-12 text-paper xl:px-16">
      <section
        aria-roledescription="carrossel"
        aria-label={t('carouselLabel')}
        className="flex w-full flex-col gap-8"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
      >
        <div className="relative min-h-[160px] md:min-h-[140px]">
          {slidesData.map((slide, i) => (
            <div
              key={slide.key + '-header'}
              className={cn(
                'absolute inset-0 transition-opacity duration-500 ease-in-out',
                i === index ? 'opacity-100 z-10' : 'pointer-events-none z-0 opacity-0'
              )}
              aria-hidden={i !== index}
            >
              {i === 0 && (
                <SlideHeader
                  kicker={t('kicker')}
                  lines={[t('heroLine1'), t('heroLine2'), t('heroLine3')]}
                  sub={t('heroSubtitle')}
                  inlineTitle
                />
              )}
              {i === 1 && (
                <SlideHeader
                  kicker={t('slideScheduleKicker')}
                  lines={[t('slideScheduleTitle1'), t('slideScheduleTitle2')]}
                  sub={t('slideScheduleSub')}
                />
              )}
              {i === 2 && (
                <SlideHeader
                  kicker={t('slideFlowKicker')}
                  lines={[t('slideFlowTitle1'), t('slideFlowTitle2')]}
                  sub={t('slideFlowSub')}
                />
              )}
            </div>
          ))}
        </div>

        <div className="overflow-hidden">
          <div
            className="flex"
            style={{
              transform: `translateX(-${index * 100}%)`,
              transition: reduced ? undefined : 'transform 0.55s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {slidesData.map((slide, i) => (
              <div
                key={slide.key}
                className="w-full shrink-0"
                aria-hidden={i !== index}
                inert={i !== index}
                aria-roledescription="slide"
                aria-label={t('slidePosition', { n: i + 1, total: count })}
              >
                {i === 0 && <CodeSlide />}
                {i === 1 && <WeekSlide />}
                {i === 2 && <FlowSlide />}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2" role="tablist" aria-label={t('carouselLabel')}>
            {slidesData.map((slide, i) => (
              <button
                key={slide.key}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={t('carouselGoTo', { n: i + 1 })}
                onClick={() => go(i)}
                className={cn(
                  'h-1.5 rounded-full outline-none transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-on-dark',
                  i === index ? 'w-6 bg-accent-on-dark' : 'w-1.5 bg-paper/25 hover:bg-paper/45',
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <CarouselButton label={t('carouselPrev')} onClick={() => go(index - 1)}>
              <ChevronLeft className="size-4" aria-hidden />
            </CarouselButton>
            <CarouselButton label={t('carouselNext')} onClick={() => go(index + 1)}>
              <ChevronRight className="size-4" aria-hidden />
            </CarouselButton>
          </div>
        </div>
      </section>

      <p className="flex items-center gap-2 text-[12px] text-paper/50">
        <a
          href="https://github.com/manypost/manypost"
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1.5 font-semibold text-paper/70 outline-none transition-colors duration-200 hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-on-dark"
        >
          <GithubIcon className="size-4" />
          {t('proofOpen')}
        </a>
        <span aria-hidden>·</span>
        {t('madeIn')}
      </p>
    </div>
  );
}

function CarouselButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-8 place-items-center rounded-md border border-paper/15 text-paper/70 outline-none transition-colors duration-200 hover:border-paper/40 hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-on-dark"
    >
      {children}
    </button>
  );
}

/** Cabeçalho comum dos slides — kicker + título display + subtítulo. */
function SlideHeader({ kicker, lines, sub, inlineTitle }: { kicker: string; lines: string[]; sub: string; inlineTitle?: boolean }) {
  return (
    <div className="flex max-w-xl flex-col gap-3.5">
      <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-accent-on-dark">
        {kicker}
      </p>
      <h2 className="font-display text-[38px] font-medium leading-[1.05] tracking-[-0.5px]">
        {lines.map((line, i) => (
          <span key={line} className={cn(inlineTitle ? 'inline-block mr-2.5' : 'block', i === lines.length - 1 ? 'text-accent-on-dark' : 'text-paper')}>
            {line}
          </span>
        ))}
      </h2>
      <p className="max-w-md text-[14px] leading-relaxed text-paper/70">{sub}</p>
    </div>
  );
}

/* ── Slide 1 — publicação como código: um request que abre em várias redes ── */

// pontos de chegada (y em %) matematicamente alinhados ao centro das 6 redes empilhadas
// Altura total: 340px. Ícone: 40px. 5 Gaps de 20px. Centros: 20, 80, 140, 200, 260, 320.
// Em porcentagem (y/340 * 100):
const FAN_Y = [5.88, 23.53, 41.18, 58.82, 76.47, 94.12];

function CodeSlide() {
  const t = useTranslations('auth');
  return (
    <div className="flex flex-col gap-8">
      <div
        className="flex h-[340px] w-full items-stretch"
        role="img"
        aria-label={t('stageFanLabel')}
      >
        <CodeCard />
        {/* cabos curvos do código para as redes — um pacote tracejado percorre
            cada fio até a rede (defasado por linha, p/ leitura de tráfego). */}
        <svg
          className="min-w-[140px] max-w-[320px] flex-1 self-stretch"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
          focusable="false"
        >
          {FAN_Y.map((y, i) => {
            const d = `M0,50 C42,50 58,${y} 100,${y}`;
            return (
              <g key={y}>
                <path className="auth-cable" fill="none" d={d} />
                <path
                  className="auth-cable-flow"
                  fill="none"
                  d={d}
                  pathLength={100}
                  style={{ animationDelay: `${i * 0.36}s` }}
                />
              </g>
            );
          })}
        </svg>
        {/* redes empilhadas */}
        <div className="flex shrink-0 flex-col justify-between">
          {AUTH_NETWORKS.map((n) => (
            <ProviderIcon
              key={n.id}
              provider={n.id}
              name={n.name}
              className="size-10 border border-paper/10"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Editor de código estilizado (mock) — reforça o ângulo dev/MCP do manypost. */
function CodeCard() {
  return (
    <div className="flex min-w-0 flex-1 flex-col self-center overflow-hidden rounded-lg border border-paper/10 bg-paper/[0.04] font-mono text-[11px] leading-[1.8]">
      <div className="flex items-center gap-2 border-b border-paper/10 px-3 py-1.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2 rounded-full bg-paper/20" />
          <span className="size-2 rounded-full bg-paper/20" />
          <span className="size-2 rounded-full bg-paper/20" />
        </span>
        <span className="text-[11px] text-paper/50">publicar.ts</span>
      </div>
      <div className="overflow-hidden px-3 py-2">
        {CODE.map((tokens, i) => (
          <div key={i} className="flex gap-2.5">
            <span className="w-3 shrink-0 select-none text-right text-paper/25">{i + 1}</span>
            <code className="whitespace-pre text-paper/85">
              {tokens.map((tk, j) => (
                <span key={j} className={TOKEN[tk.t]}>
                  {tk.v}
                </span>
              ))}
            </code>
          </div>
        ))}
      </div>
    </div>
  );
}

// paleta de "syntax" só com tokens (tints claros = texto legível sobre --night)
const TOKEN = {
  kw: 'text-accent-on-dark',
  str: 'text-state-published-tint',
  net: 'text-state-review-tint',
  com: 'text-paper/35',
  fn: 'text-paper/85',
  punc: 'text-paper/50',
} as const;
type Tok = { t: keyof typeof TOKEN; v: string };
// simulação quase real do contrato POST /v1/posts (docs/specs SPEC_API_MCP).
// Linhas curtas de propósito: o cartão é estreito p/ dar espaço aos cabos.
const CODE: Tok[][] = [
  [{ t: 'kw', v: 'await' }, { t: 'fn', v: ' fetch' }, { t: 'punc', v: '(' }, { t: 'str', v: '`${API}/v1/posts`' }, { t: 'punc', v: ', {' }],
  [{ t: 'fn', v: '  method: ' }, { t: 'str', v: '"POST"' }, { t: 'punc', v: ',' }],
  [{ t: 'fn', v: '  headers: ' }, { t: 'punc', v: '{' }, { t: 'fn', v: ' Authorization ' }, { t: 'punc', v: '},' }],
  [{ t: 'fn', v: '  body: ' }, { t: 'fn', v: 'JSON' }, { t: 'punc', v: '.' }, { t: 'fn', v: 'stringify' }, { t: 'punc', v: '({' }],
  [{ t: 'fn', v: '    text: ' }, { t: 'str', v: '"Novo lançamento 🚀"' }, { t: 'punc', v: ',' }],
  [{ t: 'fn', v: '    channelIds: ' }, { t: 'punc', v: '[' }, { t: 'net', v: 'instagram, x,' }],
  [{ t: 'net', v: '      linkedin, tiktok, youtube,' }],
  [{ t: 'net', v: '      pinterest' }, { t: 'punc', v: '],' }],
  [{ t: 'fn', v: '    publishAt: ' }, { t: 'str', v: '"2026-07-20T09:00"' }, { t: 'punc', v: ',' }],
  [{ t: 'fn', v: '    timezone: ' }, { t: 'str', v: '"America/Sao_Paulo"' }, { t: 'punc', v: ',' }],
  [{ t: 'punc', v: '  }),' }],
  [{ t: 'punc', v: '})' }],
  [{ t: 'com', v: '// → 201 · 1 grupo, 6 publicações' }],
];

/* ── Slide 2 — agendamento: uma semana com posts programados ── */

const WEEK = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function WeekSlide() {
  const t = useTranslations('auth');
  const chips: Record<number, { time: string; net: (typeof AUTH_NETWORKS)[number] }> = {
    1: { time: '09:00', net: AUTH_NETWORKS[0] },
    3: { time: '13:30', net: AUTH_NETWORKS[2] },
    5: { time: '18:00', net: AUTH_NETWORKS[3] },
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="rounded-lg border border-paper/10 bg-paper/[0.03] p-4">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-paper/50">
          {t('slideWeekLabel')}
        </p>
        <div className="grid grid-cols-7 gap-2">
          {WEEK.map((day, i) => {
            const chip = chips[i];
            return (
              <div
                key={day}
                className="flex min-h-[150px] flex-col gap-2 rounded-md border border-paper/10 bg-paper/[0.02] p-2"
              >
                <span className="text-[10px] font-semibold uppercase tracking-wide text-paper/45">
                  {day}
                </span>
                {chip ? (
                  <div className="flex flex-col gap-1.5 rounded-md border border-paper/10 bg-paper/[0.06] p-1.5">
                    <div className="flex items-center gap-1.5">
                      <ProviderIcon
                        provider={chip.net.id}
                        name={chip.net.name}
                        className="size-5 border border-paper/10"
                      />
                      <span className="text-[10px] font-semibold tabular-nums text-accent-on-dark">
                        {chip.time}
                      </span>
                    </div>
                    <span className="h-1.5 w-full rounded-sm bg-paper/12" aria-hidden />
                    <span className="h-1.5 w-3/5 rounded-sm bg-paper/12" aria-hidden />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Slide 3 — fluxo de aprovação: kanban do rascunho ao publicado ── */

function FlowSlide() {
  const t = useTranslations('auth');
  const cols = [
    { label: t('colDraft'), dot: 'bg-paper/40', cards: 2 },
    { label: t('colReview'), dot: 'bg-state-review', cards: 1 },
    { label: t('colScheduled'), dot: 'bg-accent', cards: 2 },
    { label: t('colPublished'), dot: 'bg-state-published', cards: 1 },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-4 gap-3" aria-hidden>
        {cols.map((col) => (
          <div
            key={col.label}
            className="flex min-h-[180px] flex-col gap-2 rounded-lg border border-paper/10 bg-paper/[0.03] p-2.5"
          >
            <div className="flex items-center gap-1.5">
              <span className={cn('size-1.5 rounded-full', col.dot)} />
              <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-paper/55">
                {col.label}
              </span>
            </div>
            {Array.from({ length: col.cards }).map((_, c) => (
              <div
                key={c}
                className="flex flex-col gap-1.5 rounded-md border border-paper/10 bg-paper/[0.05] p-2"
              >
                <span className="h-1.5 w-full rounded-sm bg-paper/12" />
                <span className="h-1.5 w-3/5 rounded-sm bg-paper/12" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
