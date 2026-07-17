/**
 * Deriva os campos do formulário de conexão a partir do `connectionFieldsSchema`
 * (JSON Schema) do catálogo `GET /v1/channels/providers` — nada aqui conhece
 * providers específicos; um provider novo ganha formulário de graça, como os
 * settings do composer (SPEC_FRONTEND §3.3).
 */
export type ProviderField = {
  name: string;
  type: 'text' | 'password' | 'url';
  required: boolean;
  description?: string;
};

interface FieldSchema {
  type?: string;
  format?: string;
  description?: string;
}

interface ConnectionJsonSchema {
  properties?: Record<string, FieldSchema>;
  required?: string[];
}

/** Credencial nunca aparece ao digitar — heurística pelo nome (appPassword, token, secret…). */
const SECRET_NAME_RE = /password|secret|token/i;

export function connectionFields(schema: Record<string, unknown> | undefined): ProviderField[] {
  const { properties = {}, required = [] } = (schema ?? {}) as ConnectionJsonSchema;
  return Object.entries(properties).map(([name, field]) => ({
    name,
    type: SECRET_NAME_RE.test(name) ? 'password' : field.format === 'uri' ? 'url' : 'text',
    required: required.includes(name),
    ...(field.description ? { description: field.description } : {}),
  }));
}
