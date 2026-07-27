import type { Editor } from '@tiptap/react';

/**
 * Guardas de acesso à instância do TipTap.
 *
 * O composer remonta os editores por `key` (`editorNonce`) e o `TabsContent` desmonta o editor
 * do canal ao trocar de aba — nos dois casos sobra um objeto `Editor` **existente e destruído**
 * ao alcance de quem guardou a referência. `editor?.x` não protege disso: o objeto existe, e é
 * lá dentro que estoura.
 *
 * `isDestroyed` no core é `editorView?.isDestroyed ?? true`, ou seja: instância ainda não
 * montada também responde `true`. É exatamente o que queremos — antes de a view existir não há
 * nada seguro a ler.
 */

/** instância utilizável: existe, já montou e não foi destruída pelo remount */
export const editorUtilizavel = (editor: Editor | null): editor is Editor =>
  Boolean(editor && !editor.isDestroyed);

export interface ToolbarMarks {
  bold: boolean;
  italic: boolean;
}

const NENHUMA_MARCA: ToolbarMarks = { bold: false, italic: false };

/**
 * Marcas ativas na posição do cursor, para o estado visual da toolbar.
 *
 * Ler isso no render era um bug duplo: estourava em instância destruída **e** nunca atualizava
 * ao mover o cursor, porque nada re-renderizava a toolbar. Quem chama passa isto pelo
 * `useEditorState`, que assina as mudanças de seleção.
 */
export const toolbarMarks = (editor: Editor | null): ToolbarMarks =>
  editorUtilizavel(editor)
    ? { bold: editor.isActive('bold'), italic: editor.isActive('italic') }
    : NENHUMA_MARCA;
