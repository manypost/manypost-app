import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { cn } from './utils';

const classesFrom = (html: string) => {
  const match = html.match(/\bclass="([^"]+)"/);
  expect(match).not.toBeNull();
  return new Set(match![1]!.split(/\s+/));
};

describe('merge dos tokens tipográficos do produto', () => {
  test('preserva font-size e cor como grupos independentes', () => {
    expect(cn('text-meta text-paper').split(/\s+/)).toEqual(['text-meta', 'text-paper']);
    expect(cn('text-compact text-ink').split(/\s+/)).toEqual(['text-compact', 'text-ink']);
    expect(cn('text-axis text-graphite').split(/\s+/)).toEqual(['text-axis', 'text-graphite']);
    expect(cn('text-panel text-mist').split(/\s+/)).toEqual(['text-panel', 'text-mist']);
  });

  test('continua resolvendo conflitos dentro da própria escala', () => {
    expect(cn('text-meta text-compact text-paper').split(/\s+/)).toEqual([
      'text-compact',
      'text-paper',
    ]);
  });

  test('botões preenchidos mantêm texto branco em todos os tamanhos tipográficos', () => {
    for (const [variant, size, token] of [
      ['primary', 'md', 'text-compact'],
      ['enterprise', 'sm', 'text-meta'],
      ['destructive', 'lg', 'text-panel'],
    ] as const) {
      const classes = classesFrom(
        renderToStaticMarkup(
          <Button variant={variant} size={size}>
            Criar post
          </Button>,
        ),
      );

      expect(classes).toContain('text-paper');
      expect(classes).toContain(token);
    }
  });

  test('campos mantêm tamanho, cor e estilo do placeholder', () => {
    for (const field of [
      <Input key="input" placeholder="Nome da chave" aria-label="Nome da chave" />,
      <Textarea key="textarea" placeholder="Instruções" aria-label="Instruções" />,
    ]) {
      const classes = classesFrom(renderToStaticMarkup(field));

      expect(classes).toContain('text-compact');
      expect(classes).toContain('text-ink');
      expect(classes).toContain('placeholder:text-mist');
    }
  });
});
