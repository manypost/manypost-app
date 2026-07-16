/**
 * Gera o cliente tipado da API (SPEC_FRONTEND §1): baixa /openapi.json de uma
 * API rodando, guarda o snapshot versionado (apps/web/openapi.json) e emite os
 * tipos em src/lib/api/schema.d.ts via openapi-typescript.
 *
 *   API_URL=http://localhost:3100 bun run generate:api
 *
 * O snapshot versionado permite buildar o web sem API de pé; o CI regenera e
 * falha se o contrato divergir (critério SPEC_FRONTEND §5.1).
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import openapiTS, { astToString } from 'openapi-typescript';

const base = process.env.API_URL ?? 'http://localhost:3100';
const res = await fetch(`${base}/openapi.json`).catch(() => null);
if (!res || !res.ok) {
  console.error(`✗ não consegui baixar ${base}/openapi.json — a API está rodando?`);
  process.exit(1);
}
const doc = await res.json();
// servers[] aponta p/ a instalação que gerou o doc — no web tudo é same-origin via proxy
doc.servers = [{ url: '/', description: 'mesma origem (proxy do Next)' }];

const snapshotPath = fileURLToPath(new URL('../openapi.json', import.meta.url));
const typesPath = fileURLToPath(new URL('../src/lib/api/schema.d.ts', import.meta.url));

writeFileSync(snapshotPath, `${JSON.stringify(doc, null, 2)}\n`);
const ast = await openapiTS(doc, { exportType: true });
writeFileSync(typesPath, astToString(ast));

const routes = Object.keys(doc.paths ?? {}).length;
console.log(`✓ openapi.json (${routes} rotas) → src/lib/api/schema.d.ts`);
