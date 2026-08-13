import { describe, expect, test } from 'bun:test';
import { runBatch } from './runtime';

const silencioso = () => {};

describe('runBatch — a semântica de relançamento do worker', () => {
  test('processa o lote inteiro e resolve quando nada falha', async () => {
    const vistos: number[] = [];
    await runBatch(
      [{ data: 1 }, { data: 2 }, { data: 3 }],
      async (n) => {
        vistos.push(n);
      },
      'não deveria logar',
      silencioso,
    );
    expect(vistos).toEqual([1, 2, 3]);
  });

  test('um job ruim NÃO impede os demais do lote — mas a falha sobe no fim', async () => {
    const vistos: number[] = [];
    const boom = new Error('banco fora');
    await expect(
      runBatch(
        [{ data: 1 }, { data: 2 }, { data: 3 }],
        async (n) => {
          if (n === 2) throw boom;
          vistos.push(n);
        },
        'falhou',
        silencioso,
      ),
    ).rejects.toBe(boom);
    // o job 3 rodou mesmo com o 2 quebrado: engolir o lote prenderia a publicação até o watchdog
    expect(vistos).toEqual([1, 3]);
  });

  test('com múltiplas falhas, relança a PRIMEIRA (as demais ficam no log)', async () => {
    const primeira = new Error('primeira');
    const logadas: string[] = [];
    await expect(
      runBatch(
        [{ data: 'a' }, { data: 'b' }],
        async (x) => {
          throw x === 'a' ? primeira : new Error('segunda');
        },
        'falhou',
        (_l, _m, data) => logadas.push(String((data as { err?: string })?.err)),
      ),
    ).rejects.toBe(primeira);
    expect(logadas).toHaveLength(2);
  });

  test('lote vazio resolve sem chamar o handler', async () => {
    let chamadas = 0;
    await runBatch(
      [],
      async () => {
        chamadas += 1;
      },
      'nada',
      silencioso,
    );
    expect(chamadas).toBe(0);
  });
});
