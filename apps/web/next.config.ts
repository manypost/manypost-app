import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/**
 * Modelo de origem única: o Next serve a UI e faz proxy de /v1 e /uploads para a
 * API. A sessão Clerk e o cookie temporário do OAuth de canais permanecem
 * first-party porque os caminhos públicos não são reescritos no navegador.
 */
const API_URL = process.env.API_URL ?? 'http://localhost:3100';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: '/v1/:path*', destination: `${API_URL}/v1/:path*` },
      { source: '/uploads/:path*', destination: `${API_URL}/uploads/:path*` },
      // superfície pública de aprovação (página /approve/[token] consome sem login)
      { source: '/public/:path*', destination: `${API_URL}/public/:path*` },
      // NÃO proxie o /mcp aqui: o servidor MCP vive num host dedicado (MCP_PUBLIC_URL, ex.:
      // mcp.manypost.com.br), apontado ao MESMO serviço da API. O rewrite era ponte temporária
      // e saiu porque proxy de Next não é API gateway — bufferiza e tem timeout próprio, o que
      // atrapalha o streaming do MCP. Ver docs/specs/SPEC_API_MCP.md §5.
    ];
  },
};

export default withNextIntl(nextConfig);
