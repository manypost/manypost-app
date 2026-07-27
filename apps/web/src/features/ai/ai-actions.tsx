'use client';

import { Loader2, WandSparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
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
import { editorUtilizavel } from '@/features/composer/editor-guards';
import { textToHtml } from '@/features/composer/editor';
import { cn } from '@/lib/utils';
import {
  useAiAvailability,
  useGenerateCaption,
  useRewriteText,
  useSuggestHashtags,
} from './hooks';

/**
 * Ações de IA dentro do editor do composer (SPEC_AI §3).
 *
 * Três decisões de comportamento que valem mais que o layout:
 *
 *  1. **Instalação sem IA some com o botão.** `capabilities.ai.enabled` é a fonte — não
 *     mostramos ação que responderia 404.
 *  2. **Plano sem a feature MOSTRA o botão travado.** Esconder o que é pago não converte
 *     ninguém; o clique leva ao upgrade.
 *  3. **Nada é aplicado sozinho.** Toda saída passa por `onApply`, que preenche o editor para
 *     a pessoa revisar. É o mesmo princípio de "nunca publicar em incerteza".
 */

/**
 * Reescritas oferecidas. Só as CHAVES moram aqui: rótulo e instrução vêm de
 * `composer.ai.rewrites.*` no arquivo de mensagens — o texto do usuário nunca vira instrução
 * (o back delimita), e a instrução é conteúdo de produto, não constante de componente.
 */
const REESCRITAS = [
  'shorten',
  'expand',
  'formal',
  'casual',
  'withEmoji',
  'withoutEmoji',
  'fix',
] as const;

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
  disabled?: boolean;
}

/**
 * Reexportado de `composer/editor-guards`: a guarda passou a ser compartilhada com a toolbar e
 * com o cartão do editor. Fica aqui porque o teste de regressão desta tela importa daqui.
 */
export { editorUtilizavel };

/**
 * Texto de trabalho das ações. Vem do STORE e **nunca** de uma leitura do editor — é
 * exatamente essa leitura que estourava em uso real. O parâmetro `editor` fica só para deixar
 * explícito, no teste, que a presença dele não muda a resposta.
 */
export const textoParaAplicar = (textoDoStore: string, _editor: Editor | null): string =>
  textoDoStore;

export function AiActions({ editor, text, channelIds, disabled }: AiActionsProps) {
  const t = useTranslations('composer.ai');
  const ai = useAiAvailability();
  const [open, setOpen] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  const caption = useGenerateCaption();
  const rewrite = useRewriteText();
  const hashtags = useSuggestHashtags();
  const carregando = caption.isPending || rewrite.isPending || hashtags.isPending;

  /** substitui o conteúdo — a pessoa revisa antes de agendar; nada é publicado por isto */
  const onApply = (novo: string) => {
    if (editorUtilizavel(editor)) editor.chain().focus().setContent(textToHtml(novo)).run();
  };
  const onAppend = (sufixo: string) => {
    if (editorUtilizavel(editor)) editor.chain().focus().setContent(textToHtml(text + sufixo)).run();
  };

  // instalação sem IA: a ação inteira não existe
  if (ai.isLoading || !ai.enabled) return null;

  const primeiroCanal = channelIds[0];
  const semCanal = channelIds.length === 0;
  const semTexto = text.trim().length === 0;

  const travado = !ai.hasCaption;
  const motivoBloqueio = travado ? t('locked') : ai.exhausted ? t('exhausted') : null;

  const executar = async (acao: () => Promise<void>) => {
    setErro(null);
    try {
      await acao();
      setOpen(false);
    } catch (e) {
      // problem+json: o `detail` já vem em pt-BR e explica plano/franquia/indisponibilidade
      const problema = e as { detail?: string; title?: string };
      setErro(problema.detail ?? t('failed'));
    }
  };

  const gerarLegenda = () =>
    executar(async () => {
      const variantes = await caption.mutateAsync({ brief: text, channelIds });
      const primeira = variantes[0];
      if (primeira) onApply(primeira.text);
    });

  const reescrever = (instruction: string) =>
    executar(async () => {
      const r = await rewrite.mutateAsync({ text, instruction, channelId: primeiroCanal! });
      onApply(r.text);
    });

  const sugerirHashtags = () =>
    executar(async () => {
      const tags = await hashtags.mutateAsync({ text, channelId: primeiroCanal! });
      if (tags.length > 0) onAppend(`\n\n${tags.join(' ')}`);
    });

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={t('action')}
              disabled={disabled}
              // o mousedown é o que move o foco: sem isto, abrir o menu tira o cursor do texto
              onMouseDown={(e) => e.preventDefault()}
              className={cn(
                'cursor-pointer text-graphite transition-colors duration-200',
                'hover:border-ink hover:text-ink',
                open && 'border-ink text-ink',
              )}
            >
              {carregando ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <WandSparkles className="size-4" aria-hidden />
              )}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} className="text-xs font-semibold">
          {t('action')}
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent
        align="start"
        className="w-72"
        // sem isto o Radix devolve o foco ao gatilho ao fechar e desfaz o `.focus()` que a ação
        // acabou de dar no editor — a pessoa aplicaria a IA e perderia o cursor
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span>{t('action')}</span>
          {ai.credits?.enforced ? (
            <span className="bevel-chip rounded-sm px-1.5 py-0.5 text-[11px] font-semibold text-graphite">
              {t('credits', { count: ai.credits.remaining })}
            </span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {motivoBloqueio ? (
          <div className="px-2 py-2">
            <p className="text-xs text-graphite">{motivoBloqueio}.</p>
            {travado ? (
              <Button asChild size="sm" className="mt-2 w-full cursor-pointer">
                <Link href="/planos">{t('seePlans')}</Link>
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <DropdownMenuItem
              className="cursor-pointer"
              disabled={semCanal || semTexto || carregando}
              onSelect={(e) => {
                e.preventDefault();
                void gerarLegenda();
              }}
            >
              <span className="text-sm">{t('adapt')}</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              className="cursor-pointer"
              disabled={semCanal || semTexto || carregando}
              onSelect={(e) => {
                e.preventDefault();
                void sugerirHashtags();
              }}
            >
              <span className="text-sm">{t('hashtags')}</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wide text-graphite">
              {t('rewriteTitle')}
            </DropdownMenuLabel>
            {REESCRITAS.map((chave) => (
              <DropdownMenuItem
                key={chave}
                className="cursor-pointer"
                disabled={semCanal || semTexto || carregando}
                onSelect={(e) => {
                  e.preventDefault();
                  void reescrever(t(`rewrites.${chave}.instruction`));
                }}
              >
                <span className="text-sm">{t(`rewrites.${chave}.label`)}</span>
              </DropdownMenuItem>
            ))}
          </>
        )}

        {!motivoBloqueio && (semCanal || semTexto) ? (
          <p className="px-2 pb-2 pt-1 text-[11px] leading-relaxed text-graphite">
            {semCanal ? t('needsChannel') : t('needsText')}
          </p>
        ) : null}
        {erro ? (
          <p role="alert" className="px-2 pb-2 pt-1 text-[11px] text-destructive">
            {erro}
          </p>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
