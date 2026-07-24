import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClerkCaptcha } from './clerk-captcha';

test('renders the Clerk bot-protection mount point', () => {
  expect(renderToStaticMarkup(<ClerkCaptcha />)).toContain('id="clerk-captcha"');
});
