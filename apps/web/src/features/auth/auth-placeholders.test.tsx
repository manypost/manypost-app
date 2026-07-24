import { describe, expect, it } from 'bun:test';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import messages from '@/messages/pt-BR.json';
import { PasswordInput } from './password-input';

const auth = messages.auth as Record<string, string>;

/** Todo campo da superfície de auth precisa dizer o que espera antes da digitação. */
const PLACEHOLDER_KEYS = [
  'emailPlaceholder',
  'passwordPlaceholder',
  'newPasswordPlaceholder',
  'codePlaceholder',
] as const;

describe('placeholders da superfície de auth', () => {
  it('existe um placeholder para cada campo', () => {
    for (const key of PLACEHOLDER_KEYS) {
      expect(auth[key], `falta a chave auth.${key}`).toBeTruthy();
      expect(auth[key]!.trim().length).toBeGreaterThan(0);
    }
  });

  it('o placeholder demonstra o valor em vez de repetir o rótulo', () => {
    expect(auth.emailPlaceholder!.toLowerCase()).not.toBe(auth.email!.toLowerCase());
    expect(auth.passwordPlaceholder!.toLowerCase()).not.toBe(auth.password!.toLowerCase());
    // e-mail mostra formato; código mostra a contagem de dígitos esperada
    expect(auth.emailPlaceholder).toContain('@');
    expect(auth.codePlaceholder).toMatch(/^\d{6}$/);
  });

  it('nenhum placeholder carrega dado real, credencial ou domínio de produção', () => {
    const proibido = [/gmail\.com/i, /manypost\.(app|com)/i, /sk_/i, /pk_/i, /senha123/i];
    for (const key of PLACEHOLDER_KEYS) {
      for (const re of proibido) {
        expect(auth[key], `auth.${key} não pode casar com ${re}`).not.toMatch(re);
      }
    }
  });

  it('a regra de tamanho mínimo continua numa descrição persistente, não só no placeholder', () => {
    expect(auth.passwordHint).toMatch(/12/);
  });
});

function render(node: React.ReactElement) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="pt-BR" messages={messages}>
      {node}
    </NextIntlClientProvider>,
  );
}

describe('campo de senha', () => {
  it('encaminha o placeholder para o input', () => {
    expect(render(<PasswordInput placeholder={auth.passwordPlaceholder} />)).toContain(
      `placeholder="${auth.passwordPlaceholder}"`,
    );
  });

  it('mantém o botão mostrar/ocultar acessível pelo teclado', () => {
    const html = render(<PasswordInput placeholder={auth.passwordPlaceholder} />);
    expect(html).toContain('aria-pressed');
    expect(html).not.toContain('tabindex="-1"');
  });
});
