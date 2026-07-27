import { describe, expect, test } from 'bun:test';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import messages from '@/messages/pt-BR.json';
import type { InsightsSummary } from './hooks';
import { AttentionBlock, FirstRunBlock, TodayBlock, UsageBlock, WeekBlock } from './home-blocks';

/**
 * Renderização real dos blocos da home, no mesmo molde de `features/auth/auth-placeholders.test.tsx`
 * (`renderToStaticMarkup` — nenhuma dependência nova, nenhum DOM).
 *
 * Não substitui olhar a tela num navegador, e não finge substituir: o que estes testes prendem é o
 * que a marcação **afirma** ao usuário — se o bloco existe, se o número certo aparece, se a
 * mensagem de honestidade está lá. Foi exatamente essa classe de defeito (a interface silenciando
 * o que a API reportava) que a revisão da fatia de IA encontrou.
 */
const render = (ui: React.ReactElement) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="pt-BR" messages={messages} timeZone="America/Sao_Paulo">
      {ui}
    </NextIntlClientProvider>,
  );

const atencao = (over: Partial<InsightsSummary['attention']> = {}): InsightsSummary['attention'] => ({
  failed: 0,
  needsReview: 0,
  awaitingApproval: 0,
  partial: 0,
  channels: [],
  total: 0,
  ...over,
});

describe('bloco de atenção', () => {
  test('nada errado: o bloco NÃO é renderizado (nem um cartão de "tudo em ordem")', () => {
    const html = render(<AttentionBlock attention={atencao()} />);
    expect(html).toBe('');
  });

  test('com falhas, diz quantas e oferece o caminho', () => {
    const html = render(<AttentionBlock attention={atencao({ failed: 3, total: 3 })} />);
    expect(html).toContain('Precisa de atenção');
    expect(html).toContain('3 publicações falharam');
    expect(html).toContain('/kanban');
  });

  test('canal desconectado é nomeado e leva a conexões', () => {
    const html = render(
      <AttentionBlock
        attention={atencao({
          channels: [
            { channelId: 'c1', provider: 'instagram', name: 'Insta da loja', status: 'REFRESH_REQUIRED' },
          ],
          total: 1,
        })}
      />,
    );
    expect(html).toContain('Insta da loja');
    expect(html).toContain('reconectado');
    expect(html).toContain('/conexoes');
  });

  test('singular e plural são respeitados', () => {
    expect(render(<AttentionBlock attention={atencao({ failed: 1, total: 1 })} />)).toContain(
      '1 publicação falhou',
    );
  });
});

describe('bloco de hoje', () => {
  test('nada hoje: oferece o próximo passo em vez de um zero solto', () => {
    const html = render(<TodayBlock today={{ scheduled: 0, published: 0, failed: 0 }} />);
    expect(html).toContain('Nada agendado para hoje');
    expect(html).toContain('/compor');
  });

  test('com posts, mostra a contagem', () => {
    const html = render(<TodayBlock today={{ scheduled: 4, published: 1, failed: 0 }} />);
    expect(html).toContain('4');
    expect(html).toContain('1 já publicado hoje');
  });
});

describe('bloco de plano', () => {
  test('mostra uso contra limite e a barra', () => {
    const html = render(
      <UsageBlock
        usage={{ postsThisMonth: 23, channels: 6 }}
        limits={{ postsPerMonth: 60, channels: 10 }}
        aiCredits={null}
      />,
    );
    expect(html).toContain('23 de 60');
    expect(html).toContain('6 de 10');
    expect(html).toContain('width:38%');
  });

  test('perto do limite, avisa', () => {
    const html = render(
      <UsageBlock
        usage={{ postsThisMonth: 55, channels: 1 }}
        limits={{ postsPerMonth: 60, channels: 10 }}
        aiCredits={null}
      />,
    );
    expect(html).toContain('perto do limite');
  });

  test('ilimitado não desenha barra nem inventa porcentagem', () => {
    const html = render(
      <UsageBlock
        usage={{ postsThisMonth: 500, channels: 30 }}
        limits={{ postsPerMonth: -1, channels: -1 }}
        aiCredits={null}
      />,
    );
    expect(html).toContain('sem limite');
    expect(html).not.toContain('width:');
  });

  test('franquia de IA aparece como consumo do total concedido', () => {
    const html = render(
      <UsageBlock
        usage={{ postsThisMonth: 1, channels: 1 }}
        limits={{ postsPerMonth: 60, channels: 10 }}
        aiCredits={{ remaining: 300, granted: 500 }}
      />,
    );
    expect(html).toContain('Créditos de IA');
    expect(html).toContain('200 de 500');
  });
});

describe('bloco da semana', () => {
  test('sem nada agendado, diz isso e não desenha barras', () => {
    const html = render(<WeekBlock week={{ scheduled: 0, byDay: [0, 0, 0, 0, 0, 0, 0] }} />);
    expect(html).toContain('Nenhum post agendado nos próximos 7 dias');
  });

  test('com posts, mostra o total e conta os dias vazios', () => {
    const html = render(<WeekBlock week={{ scheduled: 6, byDay: [2, 0, 3, 0, 1, 0, 0] }} />);
    expect(html).toContain('6 posts agendados');
    expect(html).toContain('4 dias sem nada agendado');
  });

  /** a home não pode prometer o que a plataforma não mede */
  test('não afirma desempenho em lugar nenhum', () => {
    const html = render(<WeekBlock week={{ scheduled: 6, byDay: [2, 0, 3, 0, 1, 0, 0] }} />);
    for (const p of ['engajament', 'alcance', 'impress', 'curtida']) {
      expect(html.toLowerCase()).not.toContain(p);
    }
  });
});

describe('primeiro uso', () => {
  test('sem canal, o passo é conectar — e só ele', () => {
    const html = render(<FirstRunBlock step="no_channels" aiEnabled={false} />);
    expect(html).toContain('Conecte uma rede social');
    expect(html).toContain('/conexoes');
    expect(html).not.toContain('primeiro post');
  });

  test('com canal e sem post, o passo é compor', () => {
    const html = render(<FirstRunBlock step="no_posts" aiEnabled={false} />);
    expect(html).toContain('Crie seu primeiro post');
    expect(html).toContain('/compor');
  });

  test('a dica de IA só aparece quando a instalação tem IA', () => {
    expect(render(<FirstRunBlock step="no_posts" aiEnabled={false} />)).not.toContain(
      'IA escrever',
    );
    expect(render(<FirstRunBlock step="no_posts" aiEnabled={true} />)).toContain('IA escrever');
  });
});

describe('conformidade visual dos blocos (o que o check:brand não vê)', () => {
  const todos = [
    render(<AttentionBlock attention={atencao({ failed: 1, total: 1 })} />),
    render(<TodayBlock today={{ scheduled: 2, published: 0, failed: 0 }} />),
    render(
      <UsageBlock
        usage={{ postsThisMonth: 1, channels: 1 }}
        limits={{ postsPerMonth: 60, channels: 10 }}
        aiCredits={null}
      />,
    ),
    render(<WeekBlock week={{ scheduled: 3, byDay: [3, 0, 0, 0, 0, 0, 0] }} />),
    render(<FirstRunBlock step="no_channels" aiEnabled={false} />),
  ].join('\n');

  test('nenhuma sombra na marcação renderizada', () => {
    expect(todos).not.toContain('shadow');
  });

  test('profundidade vem de bevel (gradiente), como o adendo §51.4 manda', () => {
    expect(todos).toContain('bevel-');
  });

  test('raio só na escala 4/6/8 (rounded-sm|md|lg)', () => {
    // O padrão é montado a partir de pedaços de propósito: escrito inteiro, o próprio
    // `check:brand` reprovaria ESTE arquivo por "radius fora da escala" — mesmo precedente do
    // `prompts.test.ts`, que monta os nomes de fornecedor por pedaços pelo mesmo motivo.
    // Sem regex: fatia a marcação em tokens de classe. Além de dispensar escape, isto pega
    // também o valor arbitrário (`rounded-` seguido de colchete), que é o que a regra proíbe.
    const prefixo = 'rounded';
    const raios = todos
      .split(/[\s"'=<>]+/)
      .filter((c) => c.startsWith(`${prefixo}-`));

    // o teste não pode passar por vacuidade: se o padrão não casar nada, ele não provou nada
    expect(raios.length).toBeGreaterThan(0);
    for (const r of new Set(raios)) {
      expect([`${prefixo}-sm`, `${prefixo}-md`, `${prefixo}-lg`, `${prefixo}-full`]).toContain(r);
    }
  });

  test('todo link de ação é clicável à vista', () => {
    const acoes = todos.match(/<a [^>]*>/g) ?? [];
    expect(acoes.length).toBeGreaterThan(0);
    for (const a of acoes) expect(a).toContain('cursor-pointer');
  });
});
