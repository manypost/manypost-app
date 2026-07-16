/**
 * Campos de conexão por provider (espelha o `connectionFieldsSchema` de cada
 * um em packages/providers — o catálogo da API ainda não expõe o schema;
 * quando expor, este mapa vira formulário auto-gerado, como os settings do
 * composer na SPEC_FRONTEND §3.3).
 */
export type ProviderField = {
  name: string;
  type: 'text' | 'password' | 'url';
  required: boolean;
};

export const PROVIDER_FIELDS: Record<string, ProviderField[]> = {
  // OAuth com instância própria: campo opcional antes do redirect
  mastodon: [{ name: 'instance', type: 'url', required: false }],
  // credenciais diretas (connectType=fields)
  bluesky: [
    { name: 'handle', type: 'text', required: true },
    { name: 'appPassword', type: 'password', required: true },
    { name: 'service', type: 'url', required: false },
  ],
  telegram: [{ name: 'chat', type: 'text', required: true }],
  discord: [{ name: 'webhookUrl', type: 'url', required: true }],
};
