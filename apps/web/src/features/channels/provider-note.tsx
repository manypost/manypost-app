'use client';

import { CircleHelp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { HoverPopover } from '@/components/ui/hover-popover';
import { useIsSelfHosted } from '@/features/billing/hooks';
import { cn } from '@/lib/utils';
import { ProviderIcon } from './provider-icon';

export type NoteProvider = { id: string; name: string; connectType: 'fields' | 'oauth' };

export type ProviderNote = {
  /** o que a rede publica e o que a pessoa precisa ter na conta dela — igual nos dois modos */
  what: string;
  /** rótulo do modo desta instalação, p/ deixar claro de qual cenário o texto abaixo fala */
  modeLabel?: string;
  /** o que ESTE modo exige: chaves no `.env` (self-host) ou nada (gerenciado) */
  setup?: string;
};

/**
 * Texto humanizado de conexão de uma rede (`connections.notes.<id>` no i18n). Rede sem texto
 * próprio cai no genérico por `connectType`, então um provider novo nunca fica mudo — só ganha
 * uma explicação mais rasa até alguém escrever a dele.
 *
 * A segunda linha muda com o modo da instalação, e some enquanto `/v1/capabilities` não
 * respondeu: mandar quem está na nuvem editar um `.env` (ou o contrário) é pior que não dizer
 * nada.
 */
export function useProviderNote(): (provider: NoteProvider) => ProviderNote {
  const t = useTranslations('connections.notes');
  const selfHosted = useIsSelfHosted();

  return (provider) => {
    const pick = (key: string, fallback: string) =>
      t.has(`${provider.id}.${key}`) ? t(`${provider.id}.${key}`) : t(fallback);

    const what = pick('what', `fallback.${provider.connectType}`);
    if (selfHosted === undefined) return { what };
    const mode = selfHosted ? 'selfHosted' : 'cloud';
    return {
      what,
      modeLabel: t(selfHosted ? 'modeSelfHostedLabel' : 'modeCloudLabel'),
      setup: pick(mode, `fallback.${mode}`),
    };
  };
}

/**
 * Ícone de interrogação para o canto de um cartão de rede — abre o popover com a nota ao passar
 * o mouse ou focar. É um botão irmão do cartão (não aninhado): o clique explica, não conecta.
 * `className` posiciona o ícone (ex.: `absolute right-2 top-2`).
 */
export function ProviderNoteHelp({
  provider,
  className,
}: {
  provider: NoteProvider;
  className?: string;
}) {
  const t = useTranslations('connections');
  const note = useProviderNote()(provider);

  return (
    <HoverPopover
      side="bottom"
      align="end"
      className="w-72"
      content={
        <div className="flex flex-col gap-2 text-[13px] leading-relaxed">
          <div className="flex items-center gap-2">
            <ProviderIcon provider={provider.id} name={provider.name} className="size-4" />
            <p className="font-medium text-ink">{provider.name}</p>
          </div>
          <p className="text-graphite">{note.what}</p>
          {note.setup ? (
            <p className="border-t border-line pt-2 text-graphite">
              <span className="font-medium text-ink">{note.modeLabel}:</span> {note.setup}
            </p>
          ) : null}
        </div>
      }
    >
      <button
        type="button"
        aria-label={t('help', { provider: provider.name })}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'bevel-surface grid size-5 place-items-center rounded-full border text-mist outline-none transition-colors duration-200',
          'hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          className,
        )}
      >
        <CircleHelp className="size-4" aria-hidden />
      </button>
    </HoverPopover>
  );
}
