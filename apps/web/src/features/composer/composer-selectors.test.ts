import { describe, expect, test } from 'bun:test';
import { shallow } from 'zustand/shallow';
import { selectComposerActions } from './composer-selectors';
import { useComposerStore } from './store';

/**
 * O seletor de ações é o que permite decompor a view sem trocar um problema por outro.
 *
 * Ele devolve um objeto NOVO a cada chamada, então sem `useShallow` o `Object.is` do React
 * veria mudança a cada render e re-renderizaria tudo — exatamente o que a decomposição veio
 * resolver. O que segura a estabilidade é as ações serem criadas uma vez dentro do `create()`
 * e nunca substituídas por um `set`. Este teste prende essa propriedade: se alguém recriar uma
 * ação dentro de um `set`, aqui quebra.
 */
describe('seletor de ações do composer', () => {
  test('permanece shallow-igual através de um setText', () => {
    const antes = selectComposerActions(useComposerStore.getState());

    useComposerStore.getState().setText('escrevendo o post');

    const depois = selectComposerActions(useComposerStore.getState());
    expect(useComposerStore.getState().text).toBe('escrevendo o post');
    expect(shallow(antes, depois)).toBe(true);
    // e não por acaso: é o MESMO objeto de função, não uma cópia equivalente
    expect(depois.setText).toBe(antes.setText);
  });

  test('permanece shallow-igual através de um reset, que troca o estado inteiro', () => {
    const antes = selectComposerActions(useComposerStore.getState());
    useComposerStore.getState().reset();
    expect(shallow(antes, selectComposerActions(useComposerStore.getState()))).toBe(true);
  });
});
