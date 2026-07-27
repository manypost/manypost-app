/**
 * Leitura defensiva de saída estruturada.
 *
 * Vive na camada de APLICAÇÃO, não em `infra/ai`, e isso é de propósito: não há nada de
 * protocolo nem de fornecedor aqui — é tratamento de texto não confiável, e é o caso de uso
 * (quem reservou a franquia) que precisa decidir o que fazer quando a leitura falha. Manter
 * `infra/ai` estritamente como "quem fala HTTP" é o que a fronteira `ia-so-pelo-port` protege.
 *
 * Um modelo pede JSON e entrega JSON *quase sempre* —
 * cercado de cerca de código, precedido de "Claro! Aqui está:", ou com uma frase depois. Nada
 * disso pode virar 500, e nada disso pode virar `throw` no meio de um caso de uso que já
 * reservou franquia: por isso a função devolve sucesso/falha em vez de lançar (SPEC_AI §5).
 */

export type Parsed = { ok: true; value: unknown } | { ok: false };

const CERCA = /^\s*```(?:json)?\s*\n?([\s\S]*?)\n?\s*```\s*$/;

/** recorta do primeiro `{`/`[` até o `}`/`]` que o fecha, ignorando chaves dentro de string */
function recortar(texto: string): string | null {
  const inicio = texto.search(/[{[]/);
  if (inicio === -1) return null;
  const abre = texto[inicio] as '{' | '[';
  const fecha = abre === '{' ? '}' : ']';

  let profundidade = 0;
  let emString = false;
  let escapado = false;

  for (let i = inicio; i < texto.length; i++) {
    const c = texto[i]!;
    if (escapado) {
      escapado = false;
      continue;
    }
    if (emString) {
      if (c === '\\') escapado = true;
      else if (c === '"') emString = false;
      continue;
    }
    if (c === '"') emString = true;
    else if (c === abre) profundidade++;
    else if (c === fecha) {
      profundidade--;
      if (profundidade === 0) return texto.slice(inicio, i + 1);
    }
  }
  return null;
}

export function parseStructured(raw: string): Parsed {
  const semCerca = raw.match(CERCA)?.[1] ?? raw;
  for (const candidato of [semCerca.trim(), recortar(semCerca)]) {
    if (!candidato) continue;
    try {
      return { ok: true, value: JSON.parse(candidato) };
    } catch {
      // tenta o próximo recorte
    }
  }
  return { ok: false };
}
