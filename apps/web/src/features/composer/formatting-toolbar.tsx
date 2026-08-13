'use client';

import { Bold, Italic, PenLine } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { editorUtilizavel, toolbarMarks } from './editor-guards';

/**
 * Grupo de formatação da toolbar do editor.
 *
 * Duas regras que valem mais que o layout:
 *  1. **Nenhum controle daqui tira o cursor do texto.** `preventDefault` no mousedown impede o
 *     blur; o menu impede o `onCloseAutoFocus`, senão o Radix devolveria o foco ao gatilho e
 *     desfaria o `.focus()` do comando.
 *  2. **Só se oferece o que a plataforma entrega.** Os trechos entram literais, e o menu diz
 *     isso — o menu de "variáveis dinâmicas" saiu porque nada substituía os marcadores antes de
 *     publicar (eles iriam para a rede como `{nome_canal}`).
 */

/** chaves dos trechos em `composer.toolbar.snippets` — o texto vive no arquivo de mensagens */
const TRECHOS = ['signature', 'cta', 'engagement'] as const;

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          // o mousedown é o que move o foco; sem isto o clique tira o cursor do texto
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClick}
          className={cn(
            'transition-colors duration-200',
            active ? 'bg-accent-tint text-accent' : 'text-graphite hover:text-ink',
          )}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" align="center" sideOffset={6} className="text-meta font-semibold">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function FormattingToolbar({ editor }: { editor: Editor | null }) {
  const t = useTranslations('composer.toolbar');
  const [trechosAbertos, setTrechosAbertos] = React.useState(false);

  // assina a seleção: sem isto o estado das marcas ficava congelado no primeiro render
  const marcas =
    useEditorState({ editor, selector: ({ editor: e }) => toolbarMarks(e) }) ??
    ({ bold: false, italic: false } as const);

  const vivo = editorUtilizavel(editor);
  const inserir = (texto: string) => {
    if (!editorUtilizavel(editor)) return;
    editor.chain().focus().insertContent(texto).run();
  };

  return (
    // 150ms em vez dos 300ms globais: numa barra só de ícones a legenda precisa vir rápido
    <TooltipProvider delayDuration={150} skipDelayDuration={0}>
      <div className="flex items-center gap-1">
        <ToolbarButton
          label={t('bold')}
          active={marcas.bold}
          disabled={!vivo}
          onClick={() => editorUtilizavel(editor) && editor.chain().focus().toggleBold().run()}
        >
          <Bold className="size-3.5" aria-hidden />
        </ToolbarButton>

        <ToolbarButton
          label={t('italic')}
          active={marcas.italic}
          disabled={!vivo}
          onClick={() => editorUtilizavel(editor) && editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="size-3.5" aria-hidden />
        </ToolbarButton>

        <DropdownMenu open={trechosAbertos} onOpenChange={setTrechosAbertos}>
          <Tooltip open={trechosAbertos ? false : undefined}>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('snippet')}
                  disabled={!vivo}
                  onMouseDown={(e) => e.preventDefault()}
                  className={cn(
                    'text-graphite transition-colors duration-200 hover:text-ink',
                    trechosAbertos && 'bg-accent-tint text-accent',
                  )}
                >
                  <PenLine className="size-3.5" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="top" align="center" sideOffset={6} className="text-meta font-semibold">
              {t('snippet')}
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent
            align="start"
            className="w-72"
            // sem isto o Radix devolve o foco ao botão e o texto perde o cursor
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
        <DropdownMenuLabel className="flex flex-col gap-1">
              <span>{t('snippet')}</span>
              <span className="text-meta font-normal leading-relaxed text-graphite">
                {t('snippetHint')}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {TRECHOS.map((chave) => {
              const texto = t(`snippets.${chave}.text`);
              return (
                <DropdownMenuItem
                  key={chave}
              className="flex cursor-pointer flex-col items-start gap-1 py-2"
                  onSelect={() => inserir(`\n\n${texto}`)}
                >
                  <span className="text-meta font-semibold text-ink">
                    {t(`snippets.${chave}.label`)}
                  </span>
                  <span className="max-w-full truncate text-meta text-graphite">
                    {texto.split('\n')[0]}
                  </span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TooltipProvider>
  );
}
