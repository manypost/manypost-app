'use client';

import { useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { AiActions, type AiActionsProps } from '@/features/ai/ai-actions';
import { cn } from '@/lib/utils';
import { useTextoDoEscopo } from './composer-selectors';
import { ComposerValidationPopover } from './composer-validation-popover';
import { ComposerEditor } from './editor';
import { FormattingToolbar } from './formatting-toolbar';
import { MediaPicker } from './media-picker';
import type { IssueScope } from './validation';

/**
 * Cartão de edição: editor + barra de ações + contador/validação.
 *
 * **Cada cartão é dono da sua instância do TipTap.** Antes havia um mapa `channelEditors`
 * içado na view, e o `TabsContent` desmontava o editor de um canal sem nunca avisar
 * (`onEditorReady(null)` não era chamado no unmount) — sobrava uma instância DESTRUÍDA
 * alcançável pela toolbar e pelas ações de IA. Com o estado aqui dentro, a referência morre
 * junto com o cartão. Preferido a `forceMount`, que manteria uma view do ProseMirror viva para
 * todo canal ao mesmo tempo.
 *
 * A barra segue três grupos (BRAND §6): formatação em `ghost`, mídia e IA em `outline`,
 * validação encostada à direita.
 */
export function ComposerEditorCard({
  escopo,
  initialText,
  onChange,
  label,
  placeholder,
  autoFocus,
  ai,
  cabecalho,
  media,
  extra,
  editorClassName,
  className,
}: {
  escopo: IssueScope;
  /** conteúdo congelado no mount — mudança externa remonta pelo `editorNonce` */
  initialText: string;
  onChange: (text: string) => void;
  label: string;
  placeholder?: string;
  autoFocus?: boolean;
  /** contrato da IA para o escopo deste cartão */
  ai: Pick<AiActionsProps, 'channelIds' | 'scope' | 'onVariants' | 'networkNameOf'>;
  /** faixa no topo do cartão (ex.: "personalizando para X" + voltar ao global) */
  cabecalho?: ReactNode;
  media?: { selectedIds: string[]; onToggle: (mediaId: string) => void; channelId?: string };
  /** controles próprios do cartão (ex.: espera e remover, na thread) */
  extra?: ReactNode;
  editorClassName?: string;
  className?: string;
}) {
  const t = useTranslations('composer');
  const [editor, setEditor] = useState<Editor | null>(null);
  // só a barra lê o texto vivo; o editor é não-controlado e não depende disto
  const texto = useTextoDoEscopo(escopo);

  return (
    <div
      className={cn(
        'bevel-surface rounded-md border transition-colors duration-200 focus-within:border-accent',
        className,
      )}
    >
      {cabecalho}
      <ComposerEditor
        initialText={initialText}
        onChange={onChange}
        placeholder={placeholder ?? t('placeholder')}
        label={label}
        autoFocus={autoFocus}
        className={cn('border-0 bg-transparent focus-within:border-0', editorClassName)}
        onEditorReady={setEditor}
      />
      <div className="flex flex-wrap items-center gap-1 border-t border-line px-2 py-1.5">
        <FormattingToolbar editor={editor} />
        <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-line" />
        {media ? (
          <MediaPicker
            selectedIds={media.selectedIds}
            onToggle={media.onToggle}
            {...(media.channelId ? { channelId: media.channelId } : {})}
          />
        ) : null}
        <AiActions editor={editor} text={texto} {...ai} />
        {extra}
        <ComposerValidationPopover escopo={escopo} className="ml-auto" />
      </div>
    </div>
  );
}
