'use client';

import { CircleAlert, Undo2, WandSparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import type { Editor } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { textToHtml } from '@/features/composer/editor';
import { editorUtilizavel } from '@/features/composer/editor-guards';
import { cn } from '@/lib/utils';
import {
  REWRITE_EDIT_IDS,
  REWRITE_TONE_IDS,
  useAiAvailability,
  useGenerateCaption,
  useRewriteText,
  useSuggestHashtags,
  type AiVariant,
  type RewriteId,
} from './hooks';

/**
 * Ações de IA dentro do editor do composer (SPEC_AI §3).
 *
 * Quatro decisões de comportamento que valem mais que o layout:
 *
 *  1. **Instalação sem IA some com o botão.** `capabilities.ai.enabled` é a fonte — não
 *     mostramos ação que responderia 404.
 *  2. **Plano sem a feature MOSTRA o botão travado.** Esconder o que é pago não converte
 *     ninguém; o clique leva ao upgrade.
 *  3. **Nada é aplicado sem a pessoa saber o que mudou.** Toda ação termina num aviso que diz o
 *     que aconteceu e oferece desfazer; reescrita acima do limite do canal **não** é aplicada
 *     sozinha, porque o texto de entrada é o da pessoa.
 *  4. **Nada gerado e pago é descartado.** Uma legenda por canal chega como override do canal
 *     que a pediu — cobrar N e mostrar 1 era jogar fora trabalho que a organização pagou.
 */

/** o que uma ação de IA produziu, para o aviso descrever em vez de a pessoa adivinhar */
type Resultado =
  | { kind: 'applied' }
  | { kind: 'appliedPerChannel'; count: number }
  | { kind: 'shortened'; network: string; max: number }
  /** pendente: passou do limite e espera decisão — o editor ainda NÃO foi tocado */
  | { kind: 'overLimit'; text: string; length: number; network: string; max: number }
  | { kind: 'undone' }
  | { kind: 'error'; detail: string };

export interface AiActionsProps {
  /**
   * Instância do editor — mesma forma do `FormattingToolbar` vizinho. Usada só para ESCREVER:
   * o editor é não-controlado (TipTap) e escrever nele dispara o `onUpdate`, que atualiza o
   * store. Ler dele durante o render não serve: o remount por `editorNonce` deixa a instância
   * anterior **destruída** pendurada aqui, e `getText()` numa instância destruída estoura
   * (`editor.state` vira null) — o `?.` não protege porque o objeto existe.
   */
  editor: Editor | null;
  /** texto atual, vindo do store — a fonte de leitura, sempre em sincronia pelo `onUpdate` */
  text: string;
  /** canais selecionados no composer; sem canal não há limite a respeitar */
  channelIds: string[];
  /**
   * Escopo da barra onde este controle vive:
   *  - `global`: um texto compartilhado por todos os canais. Reescreve SEM canal (nenhum limite
   *    alheio é imposto) e a legenda por rede vira override por canal.
   *  - `channel`: a aba de um canal só. Tudo resolve contra aquele canal.
   *  - `thread`: um item de thread, compartilhado pelas redes que suportam thread. Não oferece
   *    "adaptar para a rede" — um único item não pode ser adaptado a cinco redes ao mesmo tempo.
   */
  scope?: 'global' | 'channel' | 'thread';
  /** aplica uma legenda por canal como override — o caminho que o rascunho multicanal já usa */
  onVariants?: (variants: Array<{ channelId: string; text: string }>) => void;
  /** rótulo humano da rede, para o aviso citar "X (280)" em vez de um uuid */
  networkNameOf?: (channelId: string) => string;
  disabled?: boolean;
}

export { editorUtilizavel };

/**
 * Distribui as variantes pelos canais que as pediram.
 *
 * Existe como função pura porque é aqui que o defeito vivia: a interface cobrava um crédito por
 * canal, recebia N variantes e aplicava `variants[0]` ao texto compartilhado — as outras N-1,
 * já pagas, morriam sem ninguém ver. Variante de canal que não foi pedido é descartada (o
 * servidor já valida, mas o mapeamento não deve confiar nisso).
 */
export function variantesParaOverrides(
  variants: AiVariant[],
  pedidos: string[],
): Array<{ channelId: string; text: string }> {
  const permitidos = new Set(pedidos);
  const vistos = new Set<string>();
  const saida: Array<{ channelId: string; text: string }> = [];
  for (const v of variants) {
    if (!permitidos.has(v.channelId) || vistos.has(v.channelId)) continue;
    vistos.add(v.channelId);
    saida.push({ channelId: v.channelId, text: v.text });
  }
  return saida;
}

export type AiComposerScope = 'global' | 'channel' | 'thread';

export interface AiScopeStrategy {
  rewriteChannelId: string | undefined;
  canAdaptPerChannel: boolean;
}

/** Contrato puro entre a posição da toolbar e as operações que ela pode representar. */
export function resolveAiScope(
  scope: AiComposerScope,
  channelIds: string[],
): AiScopeStrategy {
  return {
    rewriteChannelId: scope === 'global' ? undefined : channelIds[0],
    canAdaptPerChannel: scope !== 'thread',
  };
}

export function AiActions({
  editor,
  text,
  channelIds,
  scope = 'channel',
  onVariants,
  networkNameOf,
  disabled,
}: AiActionsProps) {
  const t = useTranslations('ai');
  const ai = useAiAvailability();
  const [open, setOpen] = React.useState(false);
  const [resultado, setResultado] = React.useState<Resultado | null>(null);
  /** texto anterior à última aplicação — o que o "desfazer" restaura */
  const anterior = React.useRef<string | null>(null);

  const caption = useGenerateCaption();
  const rewrite = useRewriteText();
  const hashtags = useSuggestHashtags();
  const carregando = caption.isPending || rewrite.isPending || hashtags.isPending;

  const escrever = (novo: string) => {
    if (!editorUtilizavel(editor)) return;
    anterior.current = text;
    editor.chain().focus().setContent(textToHtml(novo)).run();
  };

  // instalação sem IA: a ação inteira não existe
  if (ai.isLoading || !ai.enabled) return null;

  const primeiroCanal = channelIds[0];
  const aiScope = resolveAiScope(scope, channelIds);
  const semCanal = channelIds.length === 0;
  const semTexto = text.trim().length === 0;
  const nomeDaRede = (id: string) => networkNameOf?.(id) ?? id;

  const travado = !ai.hasCaption;
  const motivoBloqueio = travado ? t('lockedPro') : ai.exhausted ? t('exhausted') : null;

  const executar = async (acao: () => Promise<void>) => {
    setResultado(null);
    try {
      await acao();
      setOpen(false);
    } catch (e) {
      // problem+json: o `detail` já vem em pt-BR e explica plano/franquia/indisponibilidade
      const problema = e as { detail?: string };
      setResultado({ kind: 'error', detail: problema.detail ?? t('genericError') });
    }
  };

  /**
   * Legenda por rede. No escopo global cada variante vai para o SEU canal como override; na aba
   * de um canal, direto no editor daquele canal.
   */
  const gerarLegenda = () =>
    executar(async () => {
      const variantes = await caption.mutateAsync({ brief: text, channelIds });

      if (scope === 'global' && onVariants) {
        const distribuidas = variantesParaOverrides(variantes, channelIds);
        if (distribuidas.length === 0) return;
        onVariants(distribuidas);
        setResultado({ kind: 'appliedPerChannel', count: distribuidas.length });
        return;
      }

      const primeira = variantes[0];
      if (!primeira) return;
      escrever(primeira.text);
      setResultado(
        primeira.shortened
          ? { kind: 'shortened', network: nomeDaRede(primeira.channelId), max: primeira.maxLength }
          : { kind: 'applied' },
      );
    });

  /**
   * Reescrita. No escopo global vai **sem canal**: mandar o primeiro impunha o limite de uma rede
   * não relacionada e devolvia o texto cortado — era a perda de dados que originou esta mudança.
   * Quando há canal e o resultado passa do limite, nada é escrito até a pessoa decidir.
   */
  const reescrever = (instructionId: RewriteId) =>
    executar(async () => {
      const r = await rewrite.mutateAsync({
        text,
        instructionId,
        ...(aiScope.rewriteChannelId ? { channelId: aiScope.rewriteChannelId } : {}),
      });

      if (r.overLimit && r.maxLength !== null && r.channelId) {
        setResultado({
          kind: 'overLimit',
          text: r.text,
          length: [...r.text].length,
          network: nomeDaRede(r.channelId),
          max: r.maxLength,
        });
        return;
      }
      escrever(r.text);
      setResultado({ kind: 'applied' });
    });

  const sugerirHashtags = () =>
    executar(async () => {
      // thread compartilha o texto entre redes: resolve contra o primeiro canal selecionado
      const tags = await hashtags.mutateAsync({ text, channelId: primeiroCanal! });
      if (tags.length === 0) return;
      escrever(`${text}\n\n${tags.join(' ')}`);
      setResultado({ kind: 'applied' });
    });

  const desfazer = () => {
    const previo = anterior.current;
    if (previo === null || !editorUtilizavel(editor)) return;
    editor.chain().focus().setContent(textToHtml(previo)).run();
    anterior.current = null;
    setResultado({ kind: 'undone' });
  };

  const aplicarMesmoAssim = () => {
    if (resultado?.kind !== 'overLimit') return;
    escrever(resultado.text);
    setResultado({ kind: 'applied' });
  };

  const acaoIndisponivel = semCanal || semTexto || carregando;
  /** a legenda cobra um crédito por canal — dizer isso antes do clique é o mínimo */
  const custoLegenda = channelIds.length;

  const itemReescrita = (id: RewriteId) => (
    <DropdownMenuItem
      key={id}
      className="cursor-pointer"
      disabled={semTexto || carregando}
      onSelect={(e) => {
        e.preventDefault();
        void reescrever(id);
      }}
    >
      <span className="text-compact">{t(`rewrite.${id}`)}</span>
    </DropdownMenuItem>
  );

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label={t('triggerLabel')}
                disabled={disabled}
                isLoading={carregando}
                onMouseDown={(event) => event.preventDefault()}
                className={cn(
                  'cursor-pointer text-graphite transition-colors duration-200',
                  'hover:text-ink',
                  open && 'text-ink',
                )}
              >
                {carregando ? null : <WandSparkles className="size-4" aria-hidden />}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6} className="text-meta font-semibold">
            {t('triggerLabel')}
          </TooltipContent>
        </Tooltip>

        <DropdownMenuContent
          align="start"
          className="w-72"
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <DropdownMenuLabel className="flex items-center justify-between gap-2">
            <span>{t('menuTitle')}</span>
            {ai.credits?.enforced ? (
              <span className="rounded-sm px-1.5 py-0.5 text-meta font-semibold tabular-nums text-graphite">
                {t('credits', { count: ai.credits.remaining })}
              </span>
            ) : null}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {motivoBloqueio ? (
            <div className="px-2 py-2">
              <p className="text-meta text-graphite">{motivoBloqueio}.</p>
              {travado ? (
                <Button asChild size="sm" className="mt-2 w-full cursor-pointer">
                  <Link href="/planos">{t('seePlans')}</Link>
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              {/* "adaptar para a rede" é por canal: não existe para um item de thread */}
              {aiScope.canAdaptPerChannel ? (
                <DropdownMenuItem
                  className="cursor-pointer justify-between gap-3"
                  disabled={acaoIndisponivel}
                  onSelect={(e) => {
                    e.preventDefault();
                    void gerarLegenda();
                  }}
                >
                  <span className="text-compact">
                    {scope === 'global' && channelIds.length > 1
                      ? t('adaptToNetwork')
                      : t('adaptToNetworkOne')}
                  </span>
                  {ai.credits?.enforced && custoLegenda > 1 ? (
                    <span className="text-meta tabular-nums text-graphite">
                      {t('creditsCost', { count: custoLegenda })}
                    </span>
                  ) : null}
                </DropdownMenuItem>
              ) : null}

              <DropdownMenuItem
                className="cursor-pointer"
                disabled={acaoIndisponivel}
                onSelect={(e) => {
                  e.preventDefault();
                  void sugerirHashtags();
                }}
              >
                <span className="text-compact">{t('suggestHashtags')}</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-meta font-medium text-graphite">
                {t('rewriteGroup')}
              </DropdownMenuLabel>
              {REWRITE_EDIT_IDS.map(itemReescrita)}

              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-meta font-medium text-graphite">
                {t('toneGroup')}
              </DropdownMenuLabel>
              {REWRITE_TONE_IDS.map(itemReescrita)}
            </>
          )}

          {semCanal && !motivoBloqueio ? (
            <p className="px-2 pb-2 pt-1 text-meta text-graphite">{t('needChannel')}</p>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {/*
        Aviso do resultado. `basis-full` faz dele uma linha própria dentro da barra do editor
        (que é `flex-wrap`), então ele nasce colado à ação que o produziu sem exigir plumbing
        no composer. Alert inline conforme design.md §27.1 — sem sombra, borda semântica discreta.
      */}
      <div aria-live="polite" className="basis-full">
        {carregando ? <span className="sr-only">{t('workingAnnounce')}</span> : null}
        {resultado ? <AvisoResultado resultado={resultado} t={t} onUndo={desfazer} onApply={aplicarMesmoAssim} onDismiss={() => setResultado(null)} /> : null}
      </div>
    </>
  );
}

function AvisoResultado({
  resultado,
  t,
  onUndo,
  onApply,
  onDismiss,
}: {
  resultado: Resultado;
  t: ReturnType<typeof useTranslations<'ai'>>;
  onUndo: () => void;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const problema = resultado.kind === 'error' || resultado.kind === 'overLimit';

  const texto =
    resultado.kind === 'applied'
      ? t('appliedOne')
      : resultado.kind === 'appliedPerChannel'
        ? t('appliedPerChannel', { count: resultado.count })
        : resultado.kind === 'shortened'
          ? t('shortenedNotice', { network: resultado.network, max: resultado.max })
          : resultado.kind === 'overLimit'
            ? t('overLimitNotice', {
                length: resultado.length,
                network: resultado.network,
                max: resultado.max,
              })
            : resultado.kind === 'undone'
              ? t('undone')
              : resultado.detail;

  return (
    <div
      role={problema ? 'alert' : undefined}
      className={cn(
        'mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border px-2.5 py-2',
        problema
          ? 'border-state-failed bg-state-failed-tint text-state-failed'
          : 'border-line bg-surface-2 text-graphite',
      )}
    >
      {problema ? <CircleAlert className="size-3.5 shrink-0" aria-hidden /> : null}
      <p className="min-w-0 flex-1 text-meta leading-relaxed">{texto}</p>

      {resultado.kind === 'overLimit' ? (
        <span className="flex shrink-0 items-center gap-1.5">
          <Button type="button" size="sm" variant="outline" className="h-7 cursor-pointer px-2 text-meta" onClick={onApply}>
            {t('applyAnyway')}
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-7 cursor-pointer px-2 text-meta" onClick={onDismiss}>
            {t('discard')}
          </Button>
        </span>
      ) : resultado.kind === 'applied' || resultado.kind === 'shortened' ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 shrink-0 cursor-pointer gap-1 px-2 text-meta"
          onClick={onUndo}
        >
          <Undo2 className="size-3" aria-hidden />
          {t('undo')}
        </Button>
      ) : (
        <button
          type="button"
          aria-label={t('dismiss')}
          onClick={onDismiss}
          className="shrink-0 cursor-pointer rounded-sm p-0.5 outline-none transition-colors duration-200 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}
