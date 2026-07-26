import { describe, expect, test } from 'bun:test';
import { assertMediaKey, parseMediaKey } from './media-key';

const ORG = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';
const FILE = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c.png';

describe('chave de mídia (confinamento por organização)', () => {
  test('chave bem formada é aceita e devolvida intacta', () => {
    expect(assertMediaKey(`${ORG}/${FILE}`)).toBe(`${ORG}/${FILE}`);
  });

  test('parse devolve org, arquivo e extensão em minúsculas', () => {
    expect(parseMediaKey(`${ORG}/0190A1B2-C3D4-7E5F-8A9B-0C1D2E3F4A5C.PNG`)).toEqual({
      orgId: ORG,
      file: '0190A1B2-C3D4-7E5F-8A9B-0C1D2E3F4A5C.PNG',
      ext: 'png',
    });
  });

  // um `..` num bucket não é resolvido pelo sistema de arquivos: seria um objeto
  // criado FORA do prefixo da org, silenciosamente. Barrar é a defesa dos dois drivers.
  test.each([
    ['segmento pai no meio', `${ORG}/../${FILE}`],
    ['segmento pai no início', `../${ORG}/${FILE}`],
    ['escapando para fora', `${ORG}/../../etc/passwd`],
    ['caminho absoluto', `/${ORG}/${FILE}`],
    ['caminho absoluto do Windows', `C:\\uploads\\${ORG}\\${FILE}`],
    ['barra invertida', `${ORG}\\${FILE}`],
    ['segmento a mais', `${ORG}/sub/${FILE}`],
    ['sem segmento de arquivo', `${ORG}`],
    ['org fora do formato', `nao-uma-org/${FILE}`],
    ['arquivo sem extensão', `${ORG}/${ORG}`],
    ['extensão longa demais', `${ORG}/${ORG}.extensaolonga`],
    ['vazia', ''],
  ])('recusa: %s', (_caso, key) => {
    expect(parseMediaKey(key)).toBeNull();
    expect(() => assertMediaKey(key)).toThrow(/chave de mídia inválida/);
  });
});
