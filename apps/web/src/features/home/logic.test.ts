import { describe, expect, test } from 'bun:test';
import messages from '@/messages/pt-BR.json';
import type { InsightsSummary } from './hooks';
import { diasVazios, linhasDeAtencao, medidor, periodoDoDia, primeiroNome } from './logic';

const home = messages.home as Record<string, string>;

const atencao = (over: Partial<InsightsSummary['attention']> = {}): InsightsSummary['attention'] => ({
  failed: 0,
  needsReview: 0,
  awaitingApproval: 0,
  partial: 0,
  channels: [],
  total: 0,
  ...over,
});

describe('bloco de atenção: aparece só quando há algo, e na ordem da urgência', () => {
  test('nada errado devolve lista VAZIA (a tela some com o bloco)', () => {
    expect(linhasDeAtencao(atencao())).toEqual([]);
  });

  test('falha vem antes de aprovação — perda antes de fluxo normal', () => {
    const linhas = linhasDeAtencao(atencao({ failed: 1, awaitingApproval: 5 }));
    expect(linhas.map((l) => l.kind)).toEqual(['failed', 'awaitingApproval']);
  });

  test('a ordem completa é falha → canal → parcial → revisão → aprovação', () => {
    const linhas = linhasDeAtencao(
      atencao({
        failed: 1,
        needsReview: 1,
        awaitingApproval: 1,
        partial: 1,
        channels: [{ channelId: 'ch-1', provider: 'x', name: 'Loja', status: 'REFRESH_REQUIRED' }],
      }),
    );
    expect(linhas.map((l) => l.kind)).toEqual([
      'failed',
      'channel',
      'partial',
      'needsReview',
      'awaitingApproval',
    ]);
  });

  test('cada canal desconectado é uma linha própria, nomeando o canal', () => {
    const linhas = linhasDeAtencao(
      atencao({
        channels: [
          { channelId: 'ch-1', provider: 'x', name: 'Loja', status: 'REFRESH_REQUIRED' },
          { channelId: 'ch-2', provider: 'ig', name: null, status: 'DISABLED' },
        ],
      }),
    );
    expect(linhas).toHaveLength(2);
    expect(linhas[0]!.channel?.name).toBe('Loja');
    expect(linhas[1]!.channel?.channelId).toBe('ch-2');
  });

  test('toda linha leva a algum lugar que resolve o problema', () => {
    const linhas = linhasDeAtencao(
      atencao({ failed: 1, channels: [{ channelId: 'c', provider: 'x', name: null, status: 'DISABLED' }] }),
    );
    for (const l of linhas) expect(l.href.startsWith('/')).toBe(true);
    expect(linhas.find((l) => l.kind === 'channel')!.href).toBe('/conexoes');
  });
});

describe('medidor de uso do plano', () => {
  test('uso normal vira porcentagem', () => {
    expect(medidor(23, 60).pct).toBe(38);
    expect(medidor(23, 60).nearLimit).toBe(false);
  });

  test('a partir de 80% avisa, antes de a pessoa bater na parede', () => {
    expect(medidor(48, 60).nearLimit).toBe(true);
    expect(medidor(47, 60).nearLimit).toBe(false);
  });

  test('no limite não é "perto do limite" — é outra mensagem', () => {
    const m = medidor(60, 60);
    expect(m.atLimit).toBe(true);
    expect(m.nearLimit).toBe(false);
  });

  test('uso acima do limite NÃO estoura a barra', () => {
    expect(medidor(80, 60).pct).toBe(100);
    expect(medidor(80, 60).atLimit).toBe(true);
  });

  test('ilimitado (-1) não tem barra', () => {
    const m = medidor(500, -1);
    expect(m.unlimited).toBe(true);
    expect(m.pct).toBe(0);
  });

  test('limite zero (plano não inclui) também não tem barra — uma barra ali mentiria', () => {
    const m = medidor(0, 0);
    expect(m.pct).toBe(0);
    expect(m.atLimit).toBe(false);
  });
});

describe('semana e saudação', () => {
  test('conta os dias sem nada agendado', () => {
    expect(diasVazios([2, 0, 3, 0, 1, 0, 0])).toBe(4);
    expect(diasVazios([1, 1, 1, 1, 1, 1, 1])).toBe(0);
  });

  test('o período do dia segue a hora local', () => {
    expect(periodoDoDia(0)).toBe('morning');
    expect(periodoDoDia(11)).toBe('morning');
    expect(periodoDoDia(12)).toBe('afternoon');
    expect(periodoDoDia(17)).toBe('afternoon');
    expect(periodoDoDia(18)).toBe('evening');
    expect(periodoDoDia(23)).toBe('evening');
  });

  test('a saudação usa o primeiro nome', () => {
    expect(primeiroNome('Guilherme Silva Souza')).toBe('Guilherme');
    expect(primeiroNome('  Ana  ')).toBe('Ana');
    expect(primeiroNome('')).toBeNull();
    expect(primeiroNome(null)).toBeNull();
  });
});

describe('cobertura de tradução da home', () => {
  const OBRIGATORIAS = [
    'title',
    'greetingMorning',
    'greetingAfternoon',
    'greetingEvening',
    'subtitle',
    'newPost',
    'attentionTitle',
    'attentionFailed',
    'attentionNeedsReview',
    'attentionAwaitingApproval',
    'attentionPartial',
    'attentionChannel',
    'attentionChannelGeneric',
    'goToFailed',
    'goToReview',
    'goToApproval',
    'goToPartial',
    'goToChannels',
    'todayTitle',
    'todayEmpty',
    'todayEmptyCta',
    'todayPublished',
    'todayScheduled',
    'todayFailed',
    'openCalendar',
    'usageTitle',
    'usagePosts',
    'usageChannels',
    'usageAiCredits',
    'usageUnlimited',
    'usageOf',
    'usageRenews',
    'usageNearLimit',
    'seePlans',
    'weekTitle',
    'weekTotal',
    'weekEmptyDays',
    'weekNothing',
    'firstRunTitle',
    'firstRunConnectTitle',
    'firstRunConnectBody',
    'firstRunConnectCta',
    'firstRunComposeTitle',
    'firstRunComposeBody',
    'firstRunComposeCta',
    'loadError',
  ] as const;

  test('existe uma mensagem para cada chave usada pelos componentes', () => {
    for (const key of OBRIGATORIAS) {
      expect(home[key], `falta a chave home.${key}`).toBeTruthy();
    }
  });

  /**
   * A home não pode afirmar desempenho: a plataforma não coleta engajamento (`channel_metrics`
   * está vazia). Este teste prende a regra de honestidade da spec, não a redação.
   */
  test('nenhuma mensagem da home fala de desempenho, alcance ou engajamento', () => {
    const proibidas = ['engajament', 'alcance', 'impressõ', 'impressoes', 'curtida', 'seguidor'];
    // recursivo: os blocos novos aninham chaves (home.nextAction.*) e a regra vale para elas também
    const percorrer = (no: unknown, caminho: string) => {
      if (typeof no === 'string') {
        for (const p of proibidas) {
          expect(no.toLowerCase().includes(p), `${caminho} promete métrica que não coletamos`).toBe(
            false,
          );
        }
        return;
      }
      if (no && typeof no === 'object') {
        for (const [k, v] of Object.entries(no)) percorrer(v, `${caminho}.${k}`);
      }
    };
    percorrer(home, 'home');
  });

  test('títulos não terminam com ponto (design.md §36.4)', () => {
    for (const key of ['title', 'attentionTitle', 'todayTitle', 'usageTitle', 'weekTitle', 'firstRunTitle']) {
      expect(home[key]!.endsWith('.')).toBe(false);
    }
  });
});
