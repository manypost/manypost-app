import { describe, expect, test } from 'bun:test';
import type { Editor } from '@tiptap/react';
import { editorUtilizavel, toolbarMarks } from './editor-guards';

/**
 * A toolbar lia `editor?.isActive('bold')` durante o render. Dois defeitos num só:
 *  1. o `?.` não protege de instância DESTRUÍDA (o objeto existe; estoura lá dentro);
 *  2. nada re-renderizava a toolbar ao mover o cursor, então o estado ficava congelado.
 * `toolbarMarks` resolve (1); quem chama assina o `useEditorState` e resolve (2).
 */
describe('marcas da toolbar', () => {
  test('editor ausente → nenhuma marca', () => {
    expect(toolbarMarks(null)).toEqual({ bold: false, italic: false });
  });

  test('editor destruído pelo remount nunca é lido', () => {
    let leituras = 0;
    const destruido = {
      isDestroyed: true,
      isActive: () => {
        leituras += 1;
        throw new TypeError("Cannot read properties of null (reading 'nodes')");
      },
    } as unknown as Editor;

    expect(() => toolbarMarks(destruido)).not.toThrow();
    expect(toolbarMarks(destruido)).toEqual({ bold: false, italic: false });
    expect(leituras).toBe(0);
  });

  test('editor vivo reflete as marcas na posição do cursor', () => {
    const vivo = {
      isDestroyed: false,
      isActive: (marca: string) => marca === 'bold',
    } as unknown as Editor;

    expect(toolbarMarks(vivo)).toEqual({ bold: true, italic: false });
  });

  test('editorUtilizavel separa vivo de ausente e destruído', () => {
    expect(editorUtilizavel(null)).toBe(false);
    expect(editorUtilizavel({ isDestroyed: true } as unknown as Editor)).toBe(false);
    expect(editorUtilizavel({ isDestroyed: false } as unknown as Editor)).toBe(true);
  });
});
