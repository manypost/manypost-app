'use client';

import { Placeholder } from '@tiptap/extensions';
import { EditorContent, useEditor } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { type MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { editorUtilizavel } from './editor-guards';

/**
 * Editor do composer (SPEC_FRONTEND §3.3, base TipTap). Os providers da onda 1
 * são todos `editor: 'plain'`, então o v1 edita texto puro (parágrafo + quebra
 * + undo/redo) — marcas ricas (bold/link) entram quando houver rede que as
 * aceite, senão seriam perdidas no publish. Não-controlado: quem descarta o
 * rascunho remonta via key (editorNonce do store).
 */

const escapeHtml = (s: string) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/** texto puro → parágrafos do TipTap (1 linha = 1 <p>; linha vazia = <p> vazio) */
export const textToHtml = (text: string) =>
  text
    .split('\n')
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('');

/**
 * Configurado no módulo, e não a cada render, de propósito. O `compareOptions` do
 * `@tiptap/react` compara `extensions` item a item POR REFERÊNCIA; um `StarterKit.configure()`
 * inline nunca casa, então o hook chamava `editor.setOptions()` a cada tecla — o que atravessa
 * `view.setProps()` + `view.updateState()` em todo editor montado, de graça.
 */
const STARTER_KIT = StarterKit.configure({
  blockquote: false,
  bold: {},
  bulletList: false,
  code: false,
  codeBlock: false,
  dropcursor: false,
  gapcursor: false,
  heading: false,
  horizontalRule: false,
  italic: {},
  link: false,
  listItem: false,
  listKeymap: false,
  orderedList: false,
  strike: false,
  underline: false,
});

export function ComposerEditor({
  initialText,
  onChange,
  placeholder,
  label,
  autoFocus = false,
  className,
  onEditorReady,
}: {
  initialText: string;
  onChange: (text: string) => void;
  placeholder: string;
  label: string;
  autoFocus?: boolean;
  className?: string;
  onEditorReady?: (editor: Editor | null) => void;
}) {
  // não-controlado por contrato: o conteúdo inicial congela no mount e mudança externa remonta
  // pelo `editorNonce`. Passar `initialText` direto reabriria o `setOptions` a cada tecla.
  const [conteudoInicial] = useState(() => (initialText ? textToHtml(initialText) : ''));
  const extensions = useMemo(() => [STARTER_KIT, Placeholder.configure({ placeholder })], [placeholder]);
  const editorProps = useMemo(() => ({ attributes: { 'aria-label': label } }), [label]);

  const editor = useEditor({
    immediatelyRender: false,
    autofocus: autoFocus ? 'end' : false,
    extensions,
    editorProps,
    content: conteudoInicial,
    onUpdate: ({ editor: e }) => onChange(e.getText({ blockSeparator: '\n' })),
  });

  const onEditorReadyRef = useRef(onEditorReady);
  onEditorReadyRef.current = onEditorReady;

  useEffect(() => {
    onEditorReadyRef.current?.(editor);
  }, [editor]);

  /**
   * Foco de abertura FORA do `autofocus` do create.
   *
   * O cartão só monta depois de o rascunho hidratar do localStorage (a view mostra um esqueleto
   * antes), então o foco do create acontece no meio do assentamento do `FocusScope` do diálogo e
   * perde: medido em uso, quem terminava com o foco era o `div[tabindex="-1"]` do próprio
   * diálogo. Um `requestAnimationFrame` depois do primeiro paint chega quando o escopo já parou
   * de mexer — e aí a caixa abre pronta para escrever, que é o que a spec pede.
   */
  useEffect(() => {
    // a guarda `editorUtilizavel` fica DENTRO do frame: `isDestroyed` responde `true` também
    // para instância que ainda não montou a view, então checar aqui fora desistiria sempre
    if (!autoFocus || !editor) return;
    const id = requestAnimationFrame(() => {
      if (editorUtilizavel(editor)) editor.commands.focus('end');
    });
    return () => cancelAnimationFrame(id);
  }, [autoFocus, editor]);

  /**
   * O cartão inteiro é superfície de escrita.
   *
   * Sem isto, um mousedown na moldura do cartão produzia `relatedTarget === null`; o `FocusScope`
   * do diálogo modal ignora esse caso, o foco ficava órfão no `<body>` e o ProseMirror parava de
   * receber tecla — o defeito que exigia "passar o mouse no contador" para voltar a escrever.
   * O `preventDefault` é o que impede o browser de subir até o `div[tabindex="-1"]` do diálogo.
   */
  const focarPeloCartao = (e: MouseEvent) => {
    if (e.target !== e.currentTarget) return; // dentro do texto quem manda é o ProseMirror
    if (!editorUtilizavel(editor)) return;
    e.preventDefault();
    editor.commands.focus('end');
  };

  return (
    <div
      onMouseDown={focarPeloCartao}
      className={cn(
        'cursor-text rounded-md border border-line bg-surface px-3 py-2 transition-colors duration-200',
        'focus-within:border-accent',
        '[&_.tiptap]:min-h-28 [&_.tiptap]:text-compact [&_.tiptap]:leading-relaxed [&_.tiptap]:text-ink [&_.tiptap]:outline-none',
        className,
      )}
    >
      <EditorContent editor={editor} />
    </div>
  );
}
