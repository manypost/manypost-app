import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/**
 * Modelo de origem única: o Next serve a UI e faz proxy de /v1 e /uploads para a
 * API. Os cookies httpOnly do backend ficam first-party e os `Path=` deles
 * (`/` do access, `/v1/auth` do refresh, `/v1/channels` do state de conexão)
 * continuam válidos porque os caminhos não são reescritos.
 */
const API_URL = process.env.API_URL ?? 'http://localhost:3100';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: '/v1/:path*', destination: `${API_URL}/v1/:path*` },
      { source: '/uploads/:path*', destination: `${API_URL}/uploads/:path*` },
      // superfície pública de aprovação (página /approve/[token] consome sem login)
      { source: '/public/:path*', destination: `${API_URL}/public/:path*` },
    ];
  },
};

export default withNextIntl(nextConfig);
