import { getRequestConfig } from 'next-intl/server';

/**
 * i18n sem roteamento por locale (SPEC_FRONTEND §1): v1 é pt-BR only, mas as
 * strings já vivem em messages/ — adicionar um idioma = adicionar um JSON e o
 * roteamento por prefixo depois.
 */
export default getRequestConfig(async () => {
  const locale = 'pt-BR';
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
