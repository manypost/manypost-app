'use client';

import { Globe } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { KeyboardEvent } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PROVIDER_ICONS } from '@/features/channels/provider-icon';
import { cn } from '@/lib/utils';
import { CapacityMeter } from './capacity-meter';
import { useComposerOverrides, useComposerText } from './composer-selectors';
import { useComposerUiStore } from './composer-ui-store';
import { useComposerValidation } from './use-composer-validation';

export const idDaAba = (tab: string) => `composer-tab-${tab}`;
export const idDoPainel = (tab: string) => `composer-panel-${tab}`;

/**
 * Trilho de redes — a assinatura desta tela.
 *
 * Resolve duas coisas ao mesmo tempo:
 *
 *  1. **A confusão entre as duas fileiras de avatares.** A de cima é SELEÇÃO ("para onde vai",
 *     avatares grandes); esta é NAVEGAÇÃO ("o que estou editando"), e por isso ganha cara de
 *     trilho de abas: fundo `--surface-2`, aba ativa elevada.
 *  2. **A pergunta que só um composer multicanal faz:** cabe em cada rede? Cada chip carrega um
 *     medidor contra o limite DAQUELA rede, então o mesmo texto desenha barras diferentes. O
 *     chip global mede contra o limite mais apertado entre as redes escolhidas.
 *
 * Tablist na mão (e não `Tabs` do Radix) porque o painel troca por render condicional: manter
 * um editor por canal montado ao mesmo tempo é justamente o que queremos evitar. A navegação
 * por seta/Home/End é reimplementada aqui porque é ela que torna o trilho alcançável no teclado.
 */
export function ComposerNetworkTabs({ resolvedTab }: { resolvedTab: string }) {
  const t = useTranslations('composer');
  const { selected, counters, minMax } = useComposerValidation();
  const text = useComposerText();
  const overrides = useComposerOverrides();
  const setActiveTab = useComposerUiStore((s) => s.setActiveTab);
  const setPreviewPeek = useComposerUiStore((s) => s.setPreviewPeek);

  const abas = ['global', ...selected.map((ch) => ch.id)];

  const navegar = (e: KeyboardEvent<HTMLDivElement>) => {
    const teclas = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!teclas.includes(e.key)) return;
    e.preventDefault();
    const atual = abas.indexOf(resolvedTab);
    const proxima =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? abas.length - 1
          : (atual + (e.key === 'ArrowRight' ? 1 : -1) + abas.length) % abas.length;
    const alvo = abas[proxima];
    if (!alvo) return;
    setActiveTab(alvo);
    document.getElementById(idDaAba(alvo))?.focus();
  };

  const chip = (ativo: boolean) =>
    cn(
      'relative flex w-12 shrink-0 cursor-pointer flex-col items-center gap-1.5 rounded-md border p-1.5 outline-none transition-colors duration-200',
      'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
      ativo ? 'bevel-surface border-accent' : 'border-transparent hover:bg-surface',
    );

  const globalLen = text.trim().length;

  return (
    // o hover só ESPIA a prévia; no teclado as setas trocam a aba, o que também move a prévia —
    // nenhuma função fica exclusiva do mouse
    <div
      role="tablist"
      aria-label={t('networksTablist')}
      onKeyDown={navegar}
      className="flex max-w-full gap-1 overflow-x-auto rounded-md border border-line bg-surface-2 p-1 [scrollbar-width:thin]"
    >
      <button
        type="button"
        role="tab"
        id={idDaAba('global')}
        aria-controls={idDoPainel('global')}
        aria-selected={resolvedTab === 'global'}
        tabIndex={resolvedTab === 'global' ? 0 : -1}
        aria-label={
          minMax === undefined
            ? t('rail.capacityNoLimit', { name: t('rail.global'), len: globalLen })
            : t('rail.capacity', { name: t('rail.global'), len: globalLen, max: minMax })
        }
        title={t('rail.globalHint')}
        onClick={() => setActiveTab('global')}
        onMouseEnter={() => setPreviewPeek('global')}
        onMouseLeave={() => setPreviewPeek(null)}
        className={chip(resolvedTab === 'global')}
      >
        <span
          className={cn(
            'flex size-7 items-center justify-center transition-colors duration-200',
            resolvedTab === 'global' ? 'text-accent' : 'text-graphite',
          )}
        >
          <Globe className="size-4" aria-hidden />
        </span>
        <CapacityMeter len={globalLen} max={minMax} />
      </button>

      {selected.map((ch) => {
        const ativo = resolvedTab === ch.id;
        const nome = ch.name ?? ch.username ?? ch.id;
        const contador = counters.find((c) => c.channel.id === ch.id);
        const len = contador?.len ?? 0;
        const max = contador?.max;
        return (
          <button
            key={ch.id}
            type="button"
            role="tab"
            id={idDaAba(ch.id)}
            aria-controls={idDoPainel(ch.id)}
            aria-selected={ativo}
            tabIndex={ativo ? 0 : -1}
            aria-label={
              max === undefined
                ? t('rail.capacityNoLimit', { name: nome, len })
                : t('rail.capacity', { name: nome, len, max })
            }
            title={nome}
            onClick={() => setActiveTab(ch.id)}
            onMouseEnter={() => setPreviewPeek(ch.id)}
            onMouseLeave={() => setPreviewPeek(null)}
            className={chip(ativo)}
          >
            <span className="relative flex size-7 items-center justify-center">
              <Avatar className="size-6">
                {ch.avatarUrl ? <AvatarImage src={ch.avatarUrl} alt="" /> : null}
                <AvatarFallback className="text-[10px]">{nome.charAt(0)}</AvatarFallback>
              </Avatar>
              {PROVIDER_ICONS[ch.provider] ? (
                <img
                  src={PROVIDER_ICONS[ch.provider]}
                  alt=""
                  aria-hidden
                  className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-sm border border-surface"
                />
              ) : null}
              {overrides[ch.id] !== undefined ? (
                <span
                  aria-hidden
                  title={t('rail.customized')}
                  className="absolute -right-0.5 -top-0.5 size-2 rounded-full border border-surface bg-accent"
                />
              ) : null}
            </span>
            <CapacityMeter len={len} max={max} />
          </button>
        );
      })}
    </div>
  );
}
