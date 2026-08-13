/**
 * Desembrulha uma resposta do cliente OpenAPI (`openapi-fetch`): erro problem+json vira exceção
 * (o React Query o captura como falha da query/mutação), sucesso devolve o corpo tipado.
 *
 * Substitui o boilerplate `const { data, error } = ...; if (error) throw error; return data`
 * que existia copiado em ~50 chamadas. Sites que precisam de `response` (headers/status) seguem
 * destruturando o resultado completo.
 */
export function unwrap<T>(result: { data?: T; error?: unknown }): T {
  if (result.error !== undefined) throw result.error;
  return result.data as T;
}
