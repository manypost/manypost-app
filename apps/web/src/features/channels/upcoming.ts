/**
 * Redes já decididas no roteiro ([docs/principal/platform-gates.md]) que ainda NÃO têm
 * provider no código — exibidas como "em breve" na tela de Conexões, na ordem do roadmap.
 *
 * Cada id some da lista sozinho quando aparecer no catálogo da API (`GET /v1/channels/providers`),
 * então entregar o provider basta: nada aqui precisa ser removido à mão para não duplicar.
 *
 * **Não é** a lista de "provider implementado mas sem credencial no `.env`** — esse caso não
 * aparece nem aqui nem no catálogo; o caminho dele é o `INTEGRATIONS_SETUP.md`. Fora da lista
 * de propósito: Medium (a plataforma não emite mais token novo), Twitch/Kick (publicam em chat
 * ao vivo, não em feed) e Google Business Profile (fase 3) — os três dependem de decisão.
 * Instagram também saiu daqui: o provider `instagram-standalone` (Instagram Login, sem Página do
 * Facebook) já cobre "Instagram" no catálogo. A variante via Facebook Business (`instagram`) e o
 * `facebook` continuam no roteiro.
 */
export const UPCOMING_PROVIDERS = [
  { id: 'facebook', name: 'Facebook' },
  { id: 'devto', name: 'Dev.to' },
  { id: 'slack', name: 'Slack' },
  { id: 'youtube', name: 'YouTube' },
  { id: 'pinterest', name: 'Pinterest' },
  { id: 'reddit', name: 'Reddit' },
  { id: 'dribbble', name: 'Dribbble' },
] as const;
