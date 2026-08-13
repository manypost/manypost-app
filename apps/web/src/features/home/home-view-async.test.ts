import { describe, expect, test } from 'bun:test';

const source = () => Bun.file(new URL('./home-view.tsx', import.meta.url)).text();

describe('composição assíncrona da Home', () => {
  test('erro do resumo não substitui toda a grade operacional', async () => {
    const view = await source();
    expect(view).not.toContain('resumo.isError || !ordem');
    expect(view).toContain('onRetry={() => resumo.refetch()}');
    expect(view).toContain('isPending={resumo.isPending}');
    expect(view).toContain('isError={resumo.isError}');
  });

  test('cada fonte independente passa seu próprio pending/error/retry', async () => {
    const view = await source();
    for (const query of ['upcoming', 'pipeline']) {
      expect(view).toContain(`isPending={${query}.isPending}`);
      expect(view).toContain(`isError={${query}.isError}`);
      expect(view).toContain(`onRetry={() => ${query}.refetch()}`);
    }
    expect(view).toContain('incompleta={atividadeIncompleta}');
    expect(view).toContain('isPending={atividadeSemConteudo && atividadePendente}');
    expect(view).toContain('isError={atividadeSemConteudo && atividadeComErro}');
    expect(view).toContain('void notifications.refetch()');
    expect(view).toContain('serverPending={drafts.isPending}');
    expect(view).toContain('serverError={drafts.isError}');
  });

  test('o relógio operacional avança depois do mount', async () => {
    const view = await source();
    expect(view).toContain('const [agora, setAgora] = useState(() => new Date())');
    expect(view).toContain('setInterval(() => setAgora(new Date()), 60_000)');
    expect(view).toContain('clearInterval(intervalo)');
  });
});
