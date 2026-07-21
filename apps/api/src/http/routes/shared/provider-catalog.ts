import type { ChannelProvider } from '@manypost/contracts';
import { settingsJsonSchema } from '@manypost/providers';

/** Provider disponível = todos os requiredSecrets dele presentes no env (como o login social). */
export const isProviderAvailable = (
  p: ChannelProvider,
  secrets: Record<string, Record<string, string>>,
): boolean => (p.requiredSecrets ?? []).every((k) => secrets[p.id]?.[k]);

/**
 * Uma entrada do catálogo `GET .../channels/providers` — capacidades + JSON Schema de settings
 * e de campos de conexão. Fonte única compartilhada entre a rota interna (`/v1`) e a pública
 * (`/public/v1`) para não divergir.
 */
export const providerCatalogEntry = (p: ChannelProvider) => ({
  id: p.id,
  name: p.name,
  editor: p.capabilities.editor,
  threads: p.capabilities.threads,
  twoStepConnect: p.capabilities.twoStepConnect,
  requiresMedia: p.capabilities.requiresMedia ?? false,
  /** fields = credenciais direto no app (Bluesky/Telegram); oauth = redirect */
  connectType: p.connectWithFields ? ('fields' as const) : ('oauth' as const),
  // limite base p/ contador do composer (settings do canal podem ampliar — ex.: X verified)
  maxLength: p.capabilities.maxLength(undefined),
  media: p.capabilities.media,
  settingsSchema: settingsJsonSchema(p.settingsSchema),
  // formulário de conexão auto-gerado na UI — ausente = OAuth puro, connect sem campos
  ...(p.connectionFieldsSchema
    ? { connectionFieldsSchema: settingsJsonSchema(p.connectionFieldsSchema) }
    : {}),
});
