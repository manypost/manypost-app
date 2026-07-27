'use client';

import { ChevronRight, CircleAlert, CircleCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PROVIDER_ICONS } from '@/features/channels/provider-icon';
import { cn } from '@/lib/utils';
import { CapacityMeter } from './capacity-meter';
import { useComposerText, useComposerThread } from './composer-selectors';
import { useComposerUiStore } from './composer-ui-store';
import { useComposerValidation } from './use-composer-validation';
import { type IssueScope, issuesDoEscopo } from './validation';

/**
 * A única superfície de validação do composer.
 *
 * Três coisas mudaram em relação ao contador com hover que existia antes:
 *
 *  1. **Abre por clique.** O hover não era só desconfortável: abrir e fechar o popover era a
 *     "manobra de recuperação" que devolvia o foco ao diálogo e fazia o editor voltar a
 *     aceitar tecla. Consertado o foco, o hover perdeu a única função que exercia de verdade.
 *  2. **Cada instância responde pelo seu editor** (`escopo`). O popover do canal não despeja
 *     as issues dos outros canais, como as três cópias antigas faziam.
 *  3. **Issue de canal é botão.** Clicar leva à aba daquele canal — dizer "acima do limite em
 *     Instagram" sem levar a lugar nenhum é a metade inútil do aviso.
 *
 * Sobre o foco: quando aberto pelo PONTEIRO, o cursor não sai do texto (previne o autofocus de
 * abertura e o de fechamento). Aberto pelo TECLADO, o Radix leva o foco para dentro e devolve
 * ao gatilho ao fechar — que é como um leitor de tela alcança as issues.
 */

export type ValidationVariant = 'pill' | 'footer';

export function ComposerValidationPopover({
  escopo,
  variante = 'pill',
  id,
  incluirAgendamento = false,
  className,
}: {
  escopo: IssueScope;
  variante?: ValidationVariant;
  /** id do gatilho — o CTA travado do rodapé aponta para cá com `aria-describedby` */
  id?: string;
  /** rodapé: data ausente/no passado também travam o agendamento e explicam o CTA */
  incluirAgendamento?: boolean;
  className?: string;
}) {
  const t = useTranslations('composer');
  const { counters, issues, scheduleIssues, minMax } = useComposerValidation();
  const setActiveTab = useComposerUiStore((s) => s.setActiveTab);
  const text = useComposerText();
  const thread = useComposerThread();

  const [aberto, setAberto] = React.useState(false);
  // o Radix não diz como o popover foi aberto; guardamos para escolher o comportamento de foco
  const porPonteiro = React.useRef(false);

  const doEscopo = () => {
    if (escopo.kind === 'channel') {
      const c = counters.find((x) => x.channel.id === escopo.channelId);
      return { len: c?.len ?? 0, max: c?.max };
    }
    if (escopo.kind === 'thread') {
      const item = thread.find((x) => x.key === escopo.threadKey);
      return { len: item?.text.trim().length ?? 0, max: minMax };
    }
    return { len: text.trim().length, max: minMax };
  };
  const { len, max } = doEscopo();

  const lista = [...issuesDoEscopo(issues, escopo), ...(incluirAgendamento ? scheduleIssues : [])];
  const invalido = lista.length > 0;

  // a thread vale para toda rede selecionada; repetir a lista de capacidade em cada réplica só
  // empurraria as issues para fora da vista
  const capacidades =
    escopo.kind === 'thread'
      ? []
      : escopo.kind === 'channel'
        ? counters.filter((c) => c.channel.id === escopo.channelId)
        : counters;

  if (variante === 'footer' && !invalido) return null;

  const rotuloCapacidade = (nome: string, l: number, m: number | undefined) =>
    m === undefined
      ? t('rail.capacityNoLimit', { name: nome, len: l })
      : t('rail.capacity', { name: nome, len: l, max: m });

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          aria-label={t('validation.open')}
          onPointerDown={() => {
            porPonteiro.current = true;
          }}
          onKeyDown={() => {
            porPonteiro.current = false;
          }}
          // o mousedown é o que tira o cursor do texto — o clique continua abrindo o popover
          onMouseDown={(e) => e.preventDefault()}
          className={cn(
            'flex shrink-0 cursor-pointer items-center gap-1.5 rounded-sm border px-2 py-1 text-[11px] font-semibold tabular-nums outline-none transition-colors duration-200',
            'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
            invalido
              ? 'border-state-failed bg-state-failed-tint text-state-failed'
              : 'border-line bg-surface text-graphite hover:border-ink hover:text-ink',
            className,
          )}
        >
          {invalido ? <CircleAlert className="size-3.5" aria-hidden /> : null}
          {variante === 'footer' ? (
            t('footer.blocked', { count: lista.length })
          ) : (
            <>
              {len}
              {max !== undefined ? `/${max}` : ''}
            </>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        side={variante === 'footer' ? 'top' : 'bottom'}
        className="flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-3 p-3"
        onOpenAutoFocus={(e) => {
          if (porPonteiro.current) e.preventDefault();
        }}
        onCloseAutoFocus={(e) => {
          if (porPonteiro.current) e.preventDefault();
        }}
      >
        {capacidades.length > 0 ? (
          <section className="flex flex-col gap-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-graphite">
              {t('validation.channelsTitle')}
            </h3>
            <ul className="flex flex-col gap-2">
              {capacidades.map(({ channel, max: chMax, len: chLen, over }) => {
                const nome = channel.name ?? channel.username ?? channel.id;
                return (
                  <li key={channel.id} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex min-w-0 items-center gap-1.5 text-ink">
                        {PROVIDER_ICONS[channel.provider] ? (
                          <img
                            src={PROVIDER_ICONS[channel.provider]}
                            alt=""
                            aria-hidden
                            className="size-3.5 shrink-0 rounded-sm"
                          />
                        ) : null}
                        <span className="truncate">{nome}</span>
                      </span>
                      <span
                        className={cn(
                          'shrink-0 tabular-nums',
                          over ? 'font-semibold text-state-failed' : 'text-graphite',
                        )}
                      >
                        {chLen}
                        {chMax !== undefined ? `/${chMax}` : ''}
                      </span>
                    </div>
                    <CapacityMeter len={chLen} max={chMax} />
                    <span className="sr-only">{rotuloCapacidade(nome, chLen, chMax)}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {lista.length > 0 ? (
          <section
            className={cn('flex flex-col gap-1.5', capacidades.length > 0 && 'border-t border-line pt-3')}
          >
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-graphite">
              {t('validation.issuesTitle')}
            </h3>
            <ul className="flex flex-col gap-1">
              {lista.map((issue) => {
                // em `const` local: a narrowing sobrevive à closure do `find`
                const origem = issue.origin;
                const canal =
                  origem.kind === 'channel'
                    ? counters.find((c) => c.channel.id === origem.channelId)?.channel
                    : undefined;
                if (!canal) {
                  return (
                    <li
                      key={issue.message}
                      className="px-1 py-1 text-xs leading-relaxed text-state-failed"
                    >
                      {issue.message}
                    </li>
                  );
                }
                const nome = canal.name ?? canal.username ?? canal.id;
                return (
                  <li key={issue.message}>
                    <button
                      type="button"
                      aria-label={`${issue.message} — ${t('validation.goToChannel', { name: nome })}`}
                      onClick={() => {
                        setActiveTab(canal.id);
                        setAberto(false);
                      }}
                      className={cn(
                        'flex w-full cursor-pointer items-start gap-1.5 rounded-sm px-1 py-1 text-left text-xs leading-relaxed text-state-failed outline-none transition-colors duration-200',
                        'hover:bg-state-failed-tint focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
                      )}
                    >
                      <span className="min-w-0 flex-1">{issue.message}</span>
                      <ChevronRight className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : (
          <p
            className={cn(
              'flex items-center gap-1.5 text-xs text-graphite',
              capacidades.length > 0 && 'border-t border-line pt-3',
            )}
          >
            <CircleCheck className="size-3.5 text-accent" aria-hidden />
            {capacidades.length > 0 ? t('validation.ok') : t('validation.noChannels')}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
