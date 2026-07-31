import { describe, expect, test } from 'bun:test';

const source = () => Bun.file(new URL('./settings-view.tsx', import.meta.url)).text();

describe('framing e ritmo das configurações', () => {
  test('blocos de código usam o fill rebaixado sem uma moldura interna', async () => {
    const src = await source();

    expect(src).not.toMatch(/<pre[^>]*className="[^"]*\bborder\b/);
    expect(src).not.toMatch(/<code[^>]*className="[^"]*\bborder\b/);
  });

  test('hints são agrupados com o título sem margem corretiva negativa', async () => {
    expect(await source()).not.toMatch(/\b-m[trblxy]?-/);
  });

  test('ícone de seção é opcional e o perfil não reutiliza o ícone de chaves', async () => {
    const src = await source();

    expect(src).toContain('icon?: React.ElementType');
    expect(src).toContain('{Icon ? <Icon');
    expect(src).toContain('<SectionTitle>{t(\'profileTitle\')}</SectionTitle>');
  });
});
