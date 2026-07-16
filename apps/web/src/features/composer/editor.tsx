'use client';

import { Placeholder } from '@tiptap/extensions';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { cn } from '@/lib/utils';

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
const textToHtml = (text: string) =>
  text
    .split('\n')
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('');

export function ComposerEditor({
  initialText,
  onChange,
  placeholder,
  label,
  autoFocus = false,
  className,
}: {
  initialText: string;
  onChange: (text: string) => void;
  placeholder: string;
  label: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    autofocus: autoFocus ? 'end' : false,
    extensions: [
      StarterKit.configure({
        blockquote: false,
        bold: false,
        bulletList: false,
        code: false,
        codeBlock: false,
        dropcursor: false,
        gapcursor: false,
        heading: false,
        horizontalRule: false,
        italic: false,
        link: false,
        listItem: false,
        listKeymap: false,
        orderedList: false,
        strike: false,
        underline: false,
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: initialText ? textToHtml(initialText) : '',
    editorProps: { attributes: { 'aria-label': label } },
    onUpdate: ({ editor: e }) => onChange(e.getText({ blockSeparator: '\n' })),
  });

  return (
    <div
      className={cn(
        'rounded-md border border-line bg-surface px-3 py-2 transition-colors duration-200',
        'focus-within:border-accent',
        '[&_.tiptap]:min-h-28 [&_.tiptap]:text-sm [&_.tiptap]:leading-relaxed [&_.tiptap]:text-ink [&_.tiptap]:outline-none',
        className,
      )}
    >
      <EditorContent editor={editor} />
    </div>
  );
}
