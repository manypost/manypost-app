import { describe, expect, test } from 'bun:test';
import type { components } from '@/lib/api/schema';
import {
  type Traduz,
  type ValidationInput,
  canaisHerdandoGlobal,
  computeCounters,
  computeIssues,
  computeMinMax,
  fracaoCapacidade,
  issuesDoEscopo,
  nivelCapacidade,
} from './validation';

type Channel = components['schemas']['Channel'];
type ProviderInfo = components['schemas']['ChannelProviderInfo'];
type Media = components['schemas']['Media'];

/** tradutor de teste: devolve a própria chave + os valores, então a asserção é sobre a REGRA */
const t: Traduz = Object.assign(
  (key: string, values?: Record<string, string | number>) =>
    values && Object.keys(values).length > 0 ? `${key}(${JSON.stringify(values)})` : key,
  { has: (_key: string) => false },
);

const chave = (mensagem: string) => mensagem.split('(')[0];
const chaves = (issues: Array<{ message: string }>) => issues.map((i) => chave(i.message));

const canal = (id: string, provider = 'x', name = id): Channel => ({
  id,
  provider,
  externalId: `ext-${id}`,
  name,
  username: name,
  avatarUrl: null,
  status: 'ACTIVE',
  scopes: null,
});

const provedor = (id: string, over: Partial<ProviderInfo> = {}): ProviderInfo =>
  ({
    id,
    name: id,
    editor: 'plain',
    threads: true,
    twoStepConnect: false,
    requiresMedia: false,
    connectType: 'oauth',
    maxLength: 280,
    media: {
      images: { maxCount: 4, mimeTypes: ['image/png'] },
      videos: { maxCount: 1, mimeTypes: ['video/mp4'] },
    },
    settingsSchema: {},
    ...over,
  }) as ProviderInfo;

const CATALOGO: Record<string, ProviderInfo> = {
  x: provedor('x', { maxLength: 280 }),
  instagram: provedor('instagram', { maxLength: 2200, requiresMedia: true }),
  linkedin: provedor('linkedin', { maxLength: 3000, threads: false }),
};

const entrada = (over: Partial<ValidationInput> = {}): ValidationInput => ({
  text: '',
  overrides: {},
  channelSettings: {},
  thread: [],
  selected: [],
  selectedMedia: [],
  providerOf: (id) => CATALOGO[id],
  ...over,
});

/**
 * A regressão que motivou a fatia: quem escreve um texto próprio para cada canal e deixa a caixa
 * global vazia tinha um rascunho completo travado por "Escreva o texto do post.".
 */
describe('o texto global só é exigido quando alguém ainda herda dele', () => {
  test('todo canal com texto próprio → a caixa global pode ficar vazia', () => {
    const issues = computeIssues(
      entrada({
        text: '',
        selected: [canal('a', 'x'), canal('b', 'linkedin')],
        overrides: { a: 'texto do x', b: 'texto do linkedin' },
      }),
      t,
    );
    expect(chaves(issues)).not.toContain('issues.emptyText');
    expect(issues).toHaveLength(0);
  });

  test('um canal ainda herdando → o texto global volta a ser exigido', () => {
    const issues = computeIssues(
      entrada({
        text: '',
        selected: [canal('a', 'x'), canal('b', 'linkedin')],
        overrides: { a: 'só o x tem texto próprio' },
      }),
      t,
    );
    expect(chaves(issues)).toContain('issues.emptyText');
  });

  test('sem canal escolhido, o texto global é o único conteúdo possível', () => {
    const issues = computeIssues(entrada({ text: '', selected: [] }), t);
    expect(chaves(issues)).toContain('issues.emptyText');
    expect(chaves(issues)).toContain('issues.noChannelSelected');
  });

  test('override presente porém vazio acusa o canal, nunca o texto global', () => {
    const issues = computeIssues(
      entrada({ text: '', selected: [canal('a', 'x')], overrides: { a: '   ' } }),
      t,
    );
    expect(chaves(issues)).toContain('issues.emptyOverride');
    expect(chaves(issues)).not.toContain('issues.emptyText');
  });

  test('texto global preenchido basta para quem herda', () => {
    const issues = computeIssues(entrada({ text: 'vale para todos', selected: [canal('a', 'x')] }), t);
    expect(issues).toHaveLength(0);
  });

  test('canaisHerdandoGlobal ignora quem tem override, mesmo vazio', () => {
    const selected = [canal('a'), canal('b'), canal('c')];
    const herdando = canaisHerdandoGlobal(selected, { a: 'próprio', b: '' });
    expect(herdando.map((ch) => ch.id)).toEqual(['c']);
  });
});

describe('limites por rede', () => {
  test('o contador de cada canal usa o limite da própria rede', () => {
    const counters = computeCounters(
      entrada({ text: 'a'.repeat(300), selected: [canal('a', 'x'), canal('b', 'linkedin')] }),
    );
    expect(counters[0]).toMatchObject({ max: 280, len: 300, over: true, customizado: false });
    expect(counters[1]).toMatchObject({ max: 3000, len: 300, over: false });
  });

  test('o texto próprio conta contra o limite do seu canal', () => {
    const counters = computeCounters(
      entrada({ text: 'curto', selected: [canal('a', 'x')], overrides: { a: 'a'.repeat(281) } }),
    );
    expect(counters[0]).toMatchObject({ len: 281, over: true, customizado: true });
  });

  test('estourar o limite gera uma issue POR canal, cada uma apontando o seu', () => {
    const issues = computeIssues(
      entrada({ text: 'a'.repeat(3001), selected: [canal('a', 'x'), canal('b', 'linkedin')] }),
      t,
    );
    const acima = issues.filter((i) => chave(i.message) === 'issues.overLimit');
    expect(acima).toHaveLength(2);
    expect(acima.map((i) => i.origin)).toEqual([
      { kind: 'channel', channelId: 'a' },
      { kind: 'channel', channelId: 'b' },
    ]);
  });

  test('minMax é o limite mais apertado entre os selecionados', () => {
    expect(
      computeMinMax([canal('a', 'x'), canal('b', 'linkedin')], (id) => CATALOGO[id]),
    ).toBe(280);
    expect(computeMinMax([], (id) => CATALOGO[id])).toBeUndefined();
  });
});

describe('medidor de capacidade', () => {
  test('vazio, dentro, perto e acima', () => {
    expect(nivelCapacidade(0, 280)).toBe('vazio');
    expect(nivelCapacidade(100, 280)).toBe('ok');
    expect(nivelCapacidade(252, 280)).toBe('perto'); // 90% cravado
    expect(nivelCapacidade(281, 280)).toBe('acima');
  });

  test('rede sem limite declarado nunca acusa excesso', () => {
    expect(nivelCapacidade(9999, undefined)).toBe('ok');
    expect(fracaoCapacidade(9999, undefined)).toBe(1);
  });

  test('a fração não passa de 1, para a barra não vazar', () => {
    expect(fracaoCapacidade(140, 280)).toBe(0.5);
    expect(fracaoCapacidade(560, 280)).toBe(1);
  });
});

describe('regras herdadas que continuam valendo', () => {
  test('rede que exige mídia acusa quando não há nenhuma', () => {
    const issues = computeIssues(
      entrada({ text: 'oi', selected: [canal('a', 'instagram')] }),
      t,
    );
    expect(chaves(issues)).toContain('issues.requiresMedia');
  });

  test('mídia acima do teto da rede acusa o canal', () => {
    const imagem = (id: string): Media => ({
      id,
      url: `https://exemplo/${id}.png`,
      mime: 'image/png',
      byteSize: 1000,
      width: 10,
      height: 10,
      alt: null,
      createdAt: '2026-07-27T00:00:00.000Z',
    });
    const issues = computeIssues(
      entrada({
        text: 'oi',
        selected: [canal('a', 'x')],
        selectedMedia: ['1', '2', '3', '4', '5'].map(imagem),
      }),
      t,
    );
    expect(chaves(issues)).toContain('issues.media.tooManyImages');
  });

  test('setting obrigatória ausente acusa o canal', () => {
    const comObrigatoria = provedor('discord', { settingsSchema: { required: ['channelId'] } });
    const issues = computeIssues(
      entrada({
        text: 'oi',
        selected: [canal('a', 'discord')],
        providerOf: (id) => (id === 'discord' ? comObrigatoria : CATALOGO[id]),
      }),
      t,
    );
    expect(chaves(issues)).toContain('issues.missingSetting');
  });

  test('thread em rede que não aceita acusa o post', () => {
    const issues = computeIssues(
      entrada({
        text: 'oi',
        selected: [canal('a', 'linkedin')],
        thread: [{ key: 'k1', text: 'réplica', delaySec: 0 }],
      }),
      t,
    );
    expect(chaves(issues)).toContain('issues.threadUnsupported');
  });

  test('item de thread vazio, acima do minMax e com espera inválida', () => {
    const issues = computeIssues(
      entrada({
        text: 'oi',
        selected: [canal('a', 'x')],
        thread: [
          { key: 'k1', text: '', delaySec: 0 },
          { key: 'k2', text: 'a'.repeat(281), delaySec: 601 },
        ],
      }),
      t,
    );
    expect(chaves(issues)).toContain('issues.threadEmpty');
    expect(chaves(issues)).toContain('issues.threadOverLimit');
    expect(chaves(issues)).toContain('issues.threadDelay');
    const doItem2 = issues.filter(
      (i) => i.origin.kind === 'thread' && i.origin.threadKey === 'k2',
    );
    expect(doItem2).toHaveLength(2);
  });
});

describe('cada editor mostra só o que lhe diz respeito', () => {
  const issues = computeIssues(
    entrada({
      text: 'a'.repeat(281),
      selected: [canal('a', 'x'), canal('b', 'instagram')],
      thread: [{ key: 'k1', text: '', delaySec: 0 }],
    }),
    t,
  );

  test('a caixa global responde pelo post e por todos os canais', () => {
    const doEscopo = issuesDoEscopo(issues, { kind: 'global' });
    expect(chaves(doEscopo)).toContain('issues.overLimit');
    expect(chaves(doEscopo)).toContain('issues.requiresMedia');
    expect(chaves(doEscopo)).not.toContain('issues.threadEmpty');
  });

  test('a aba de um canal não mostra o problema de outro', () => {
    const doCanalA = issuesDoEscopo(issues, { kind: 'channel', channelId: 'a' });
    expect(chaves(doCanalA)).toContain('issues.overLimit');
    expect(chaves(doCanalA)).not.toContain('issues.requiresMedia'); // é do canal b
  });

  test('o item de thread mostra o seu, não o dos canais', () => {
    const doItem = issuesDoEscopo(issues, { kind: 'thread', threadKey: 'k1' });
    expect(chaves(doItem)).toContain('issues.threadEmpty');
    expect(chaves(doItem)).not.toContain('issues.overLimit');
  });

  test('mensagens repetidas aparecem uma vez só', () => {
    const repetida = { message: 'igual', origin: { kind: 'post' } } as const;
    expect(issuesDoEscopo([repetida, repetida], { kind: 'global' })).toHaveLength(1);
  });
});
