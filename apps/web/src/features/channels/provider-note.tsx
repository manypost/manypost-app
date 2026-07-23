'use client';

import { useTranslations } from 'next-intl';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsSelfHosted } from '@/features/billing/hooks';
import { cn } from '@/lib/utils';

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
 * Ícone de interrogação para o canto de um cartão de rede — mostra a nota ao passar o mouse ou
 * focar, no tooltip padrão do app (superfície escura, só texto). É um botão irmão do cartão (não
 * aninhado): o clique explica, não conecta. `className` posiciona o ícone (ex.: `absolute right-2
 * top-2`).
 *
 * Aqui entra só o `what` — o que a rede publica. O que ESTA instalação exige (chaves no `.env` ou
 * nada) fica no diálogo de conexão, que é onde a informação vira ação; no catálogo ela só
 * atravancava a leitura.
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
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={t('help', { provider: provider.name })}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            // Pastilha de acento igual ao botão primário (`bevel-primary`: face em gradiente
            // accent→accent-hover, hover por brightness) com a interrogação em branco no centro.
            // O glifo é texto, não `CircleHelp`: o ícone traz o próprio círculo e desenharia um
            // segundo anel dentro da pastilha.
            'bevel-primary grid size-5 cursor-pointer place-items-center rounded-full border',
            'text-[11px] font-bold leading-none text-paper outline-none',
            'transition duration-200 hover:brightness-95',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            className,
          )}
        >
          <span aria-hidden>?</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="end" className="max-w-72 font-normal leading-relaxed">
        {note.what}
      </TooltipContent>
    </Tooltip>
  );
}
