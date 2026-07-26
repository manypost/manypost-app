/**
 * Verificação REAL do storage de bucket (opcional — grava e apaga um objeto de teste).
 * Não roda no CI: é o que os testes com dublê não conseguem provar — que o `Bun.S3Client`
 * assina uma requisição que o R2/S3/MinIO aceita, e que a `MEDIA_PUBLIC_URL` configurada
 * realmente serve o objeto **sem credencial** (é assim que a família Meta e o Dev.to buscam).
 *
 * Rode com as MESMAS variáveis do serviço (nada é lido de código):
 *   STORAGE_PROVIDER=s3 S3_BUCKET=... S3_ENDPOINT=... S3_REGION=auto \
 *   S3_ACCESS_KEY_ID=... S3_SECRET_ACCESS_KEY=... MEDIA_PUBLIC_URL=https://media.dominio \
 *   PUBLIC_URL=http://localhost:3000 DATABASE_URL=... REDIS_URL=... ENCRYPTION_KEY=... \
 *     bun run scripts/live-r2.ts
 *
 * Um `MEDIA_PUBLIC_URL` errado não falha aqui por acaso: ele falha no passo 3, com a URL
 * impressa. Descobrir isso agora é barato — para a família Meta, mídia inalcançável é falha
 * PERMANENTE do post (o container volta ERROR).
 */
import { mediaStorageConfigFromEnv, loadEnv } from '@manypost/config';
import { makeMediaStorage } from '@manypost/core';

export {};

const env = loadEnv();
const config = mediaStorageConfigFromEnv(env);
if (config.driver !== 's3') {
  console.error('STORAGE_PROVIDER=s3 é o alvo deste script (o driver local não precisa dele)');
  process.exit(2);
}
console.log(`bucket: ${config.bucket}${config.endpoint ? ` @ ${config.endpoint}` : ''}`);
console.log(`base pública: ${config.publicBase}`);

const storage = makeMediaStorage(config);
// chave descartável na forma real (<orgId>/<uuid>.<ext>) — apagada no fim
const key = `${crypto.randomUUID()}/${crypto.randomUUID()}.png`;
// PNG 1x1 mínimo, só para ter bytes verificáveis de ponta a ponta
const bytes = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89,
]);

const falhar = (msg: string): never => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

try {
  console.log('1/4 gravando...');
  await storage.put(key, bytes, 'image/png');

  console.log('2/4 lendo pelo driver...');
  const lido = await storage.read(key);
  if (!lido || Buffer.compare(Buffer.from(lido), Buffer.from(bytes)) !== 0) {
    falhar('os bytes lidos não são os gravados');
  }

  const url = storage.publicUrl(key);
  console.log(`3/4 buscando SEM credencial: ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    falhar(
      `a URL pública respondeu HTTP ${res.status}. É o que as redes veriam: confira MEDIA_PUBLIC_URL ` +
        'e se o bucket permite leitura anônima',
    );
  }
  const baixado = new Uint8Array(await res.arrayBuffer());
  if (Buffer.compare(Buffer.from(baixado), Buffer.from(bytes)) !== 0) {
    falhar('a URL pública serviu bytes diferentes (base apontando para outro bucket/prefixo?)');
  }

  console.log('✓ storage de bucket verificado de ponta a ponta');
} finally {
  console.log('4/4 apagando o objeto de teste...');
  await storage.delete(key).catch((err: unknown) => {
    console.error(`aviso: não consegui apagar ${key} — apague à mão. ${String(err).slice(0, 200)}`);
  });
}
