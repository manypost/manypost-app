import { describe, expect, test } from 'bun:test';
import { AesGcmCryptoService, safeEqualHex } from './aes-gcm.service';

const HEX_KEY = 'a'.repeat(64);
const svc = AesGcmCryptoService.fromHex(HEX_KEY);

describe('AesGcmCryptoService (SPEC_DATA §5)', () => {
  test('round-trip com AAD', async () => {
    const { ciphertext, keyVersion } = await svc.encrypt('token-secreto-da-rede', 'channel-123');
    expect(keyVersion).toBe(1);
    expect(await svc.decrypt(ciphertext, 'channel-123', keyVersion)).toBe('token-secreto-da-rede');
  });

  test('nonce aleatório: mesmo plaintext gera ciphertexts diferentes', async () => {
    const a = await svc.encrypt('mesmo-valor', 'ch');
    const b = await svc.encrypt('mesmo-valor', 'ch');
    expect(Buffer.from(a.ciphertext).equals(Buffer.from(b.ciphertext))).toBe(false);
  });

  test('AAD errado (registro trocado de canal) falha', async () => {
    const { ciphertext } = await svc.encrypt('t', 'channel-A');
    await expect(svc.decrypt(ciphertext, 'channel-B', 1)).rejects.toThrow();
  });

  test('ciphertext adulterado falha (autenticação GCM)', async () => {
    const { ciphertext } = await svc.encrypt('token', 'ch');
    const tampered = Uint8Array.from(ciphertext);
    tampered[14] = tampered[14]! ^ 0xff;
    await expect(svc.decrypt(tampered, 'ch', 1)).rejects.toThrow();
  });

  test('versão de chave desconhecida falha', async () => {
    const { ciphertext } = await svc.encrypt('token', 'ch');
    await expect(svc.decrypt(ciphertext, 'ch', 99)).rejects.toThrow('versão de chave');
  });

  test('chave inválida é rejeitada na construção', () => {
    expect(() => AesGcmCryptoService.fromHex('curta')).toThrow('ENCRYPTION_KEY inválida');
  });
});

describe('safeEqualHex', () => {
  test('igual/diferente/tamanho diferente', () => {
    expect(safeEqualHex('deadbeef', 'deadbeef')).toBe(true);
    expect(safeEqualHex('deadbeef', 'deadbeee')).toBe(false);
    expect(safeEqualHex('dead', 'deadbeef')).toBe(false);
  });
});
