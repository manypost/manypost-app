'use client';

import { useTranslations } from 'next-intl';
import { useCarousel } from './stage/carousel';
import { DiagramSlide } from './stage/slides/diagram-slide';
import { FlowSlide } from './stage/slides/flow-slide';
import { ScheduleSlide } from './stage/slides/schedule-slide';
import { StageControls } from './stage/stage-controls';
import { GithubIcon } from './social-icons';

const AUTOPLAY_MS = 6000;

const SLIDES = [DiagramSlide, ScheduleSlide, FlowSlide];

/**
 * Palco da marca no "momento dark" (BRAND §3 --night). Desenhado só com
 * materiais do design system: tokens, hairlines, zero sombra.
 *
 * Só o slide atual é montado. Isso resolve três coisas de uma vez: nada de
 * slide fora de tela no tab order ou na árvore de acessibilidade, a entrada
 * reexecuta sozinha a cada troca (o `key` remonta) e a transição vira um fade
 * simples — coerente com "só fade" da BRAND §8.5, sem trilho translate.
 * A altura é constante porque todo slide passa pela mesma moldura
 * (`SlideFrame`), então controles e rodapé nunca se mexem.
 */
export function BrandStage() {
  const t = useTranslations('auth');
  const { index, cycle, autoplay, goTo, setPaused } = useCarousel(SLIDES.length, AUTOPLAY_MS);
  const CurrentSlide = SLIDES[index]!;

  return (
    <div className="auth-grid flex flex-1 flex-col justify-center overflow-hidden bg-night px-8 py-12 text-paper xl:px-16">
      {/* uma medida só para palco e rodapé, centrada no painel — senão a
          composição encosta à esquerda e sobra um vão morto à direita */}
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <section
          aria-roledescription="carrossel"
          aria-label={t('carouselLabel')}
          className="flex flex-col gap-8"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
        >
          <div
            key={index}
            aria-roledescription="slide"
            aria-label={t('slidePosition', { n: index + 1, total: SLIDES.length })}
          >
            <CurrentSlide />
          </div>

          <StageControls
            count={SLIDES.length}
            index={index}
            cycle={cycle}
            autoplay={autoplay}
            durationMs={AUTOPLAY_MS}
            onGoTo={goTo}
          />
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
    </div>
  );
}
