import { describe, expect, test } from 'bun:test';
import messages from '@/messages/pt-BR.json';
import { LIMITE_DO_LOTE, planoDoLote, resumoDoLote } from './bulk';
import type { GroupCard } from './logic';

const kanban = messages.kanban as { bulk: { reasons: Record<string, string> } };

const card = (over: Partial<GroupCard> = {}): GroupCard => ({
  groupId: over.groupId ?? 'g1',
  state: 'SCHEDULED',
  awaitingApproval: false,
  origin: 'WEB',
  publishAt: '2026-07-30T12:00:00.000Z',
  text: 'texto',
  items: [],
  errorMessage: null,
  column: 'scheduled',
  ...over,
});

describe('planoDoLote: separa elegível de ignorado ANTES de mandar qualquer requisição', () => {
  test('retry só aceita cards em Falhou, e diz por que ignorou o resto', () => {
    const plano = planoDoLote(
      [
        card({ groupId: 'a', column: 'failed' }),
        card({ groupId: 'b', column: 'scheduled' }),
        card({ groupId: 'c', column: 'failed' }),
      ],
      'retry',
    );
    expect(plano.elegiveis.map((c) => c.groupId)).toEqual(['a', 'c']);
    expect(plano.ignorados).toEqual([{ groupId: 'b', motivo: 'notRetryable' }]);
  });

  test('cancel aceita rascunho, aguardando e agendado — e recusa publicado', () => {
    const plano = planoDoLote(
      [
        card({ groupId: 'a', column: 'draft' }),
        card({ groupId: 'b', column: 'awaiting' }),
        card({ groupId: 'c', column: 'scheduled' }),
        card({ groupId: 'd', column: 'published' }),
      ],
      'cancel',
    );
    expect(plano.elegiveis.map((c) => c.groupId)).toEqual(['a', 'b', 'c']);
    expect(plano.ignorados).toEqual([{ groupId: 'd', motivo: 'notCancellable' }]);
  });

  test('nada elegível devolve lista vazia sem estourar', () => {
    const plano = planoDoLote([card({ column: 'published' })], 'retry');
    expect(plano.elegiveis).toEqual([]);
    expect(plano.excedeLimite).toBe(false);
  });

  test('seleção acima do limite é sinalizada em vez de disparar um burst', () => {
    const muitos = Array.from({ length: LIMITE_DO_LOTE + 1 }, (_, i) =>
      card({ groupId: `g${i}`, column: 'failed' }),
    );
    const plano = planoDoLote(muitos, 'retry');
    expect(plano.excedeLimite).toBe(true);
  });

  test('exatamente no limite ainda passa', () => {
    const nolimite = Array.from({ length: LIMITE_DO_LOTE }, (_, i) =>
      card({ groupId: `g${i}`, column: 'failed' }),
    );
    expect(planoDoLote(nolimite, 'retry').excedeLimite).toBe(false);
  });

  test('todo motivo de ignorado tem tradução', () => {
    const plano = planoDoLote(
      [card({ groupId: 'a', column: 'published' }), card({ groupId: 'b', column: 'scheduled' })],
      'retry',
    );
    for (const i of plano.ignorados) {
      expect(typeof kanban.bulk.reasons[i.motivo]).toBe('string');
    }
  });
});

describe('resumoDoLote: falha parcial é o caso NORMAL, não uma exceção', () => {
  test('tudo certo', () => {
    const r = resumoDoLote([
      { groupId: 'a', ok: true },
      { groupId: 'b', ok: true },
    ]);
    expect(r).toEqual({ tipo: 'allOk', ok: 2, fail: 0, falhas: [] });
  });

  test('parte falhou: reporta os dois números e guarda quais', () => {
    const r = resumoDoLote([
      { groupId: 'a', ok: true },
      { groupId: 'b', ok: false, erro: 'canal desconectado' },
    ]);
    expect(r.tipo).toBe('partial');
    expect(r.ok).toBe(1);
    expect(r.fail).toBe(1);
    expect(r.falhas).toEqual([{ groupId: 'b', erro: 'canal desconectado' }]);
  });

  test('tudo falhou não é reportado como sucesso parcial', () => {
    const r = resumoDoLote([
      { groupId: 'a', ok: false, erro: 'x' },
      { groupId: 'b', ok: false, erro: 'y' },
    ]);
    expect(r.tipo).toBe('allFailed');
    expect(r.ok).toBe(0);
  });

  test('lote vazio não vira "tudo certo"', () => {
    expect(resumoDoLote([]).tipo).toBe('vazio');
  });
});
