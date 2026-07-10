import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';
import type { CryptoService } from '../../application/ports/crypto';

const NONCE_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

/**
 * AES-256-GCM com nonce aleatório por registro e AAD (SPEC_DATA §5).
 * Formato armazenado: nonce(12) || ciphertext || tag(16).
 * Suporta múltiplas versões de chave para rotação (re-encrypt em background).
 */
export class AesGcmCryptoService implements CryptoService {
  private readonly keys: Map<number, Buffer>;

  constructor(keys: Map<number, Buffer>, private readonly currentVersion: number) {
    for (const [version, key] of keys) {
      if (key.length !== KEY_LEN) {
        throw new Error(`ENCRYPTION_KEY v${version}: esperado ${KEY_LEN} bytes, veio ${key.length}`);
      }
    }
    if (!keys.has(currentVersion)) {
      throw new Error(`versão de chave corrente (${currentVersion}) ausente do keyring`);
    }
    this.keys = keys;
  }

  /** Constrói a partir do env ENCRYPTION_KEY (32 bytes em hex — 64 chars). */
  static fromHex(hexKey: string, version = 1): AesGcmCryptoService {
    if (!/^[0-9a-fA-F]{64}$/.test(hexKey)) {
      throw new Error('ENCRYPTION_KEY inválida: use 64 chars hex (openssl rand -hex 32)');
    }
    return new AesGcmCryptoService(new Map([[version, Buffer.from(hexKey, 'hex')]]), version);
  }

  async encrypt(plaintext: string, aad: string) {
    const key = this.keys.get(this.currentVersion)!;
    const nonce = randomBytes(NONCE_LEN);
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    cipher.setAAD(Buffer.from(aad, 'utf8'));
    const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      ciphertext: new Uint8Array(Buffer.concat([nonce, body, tag])),
      keyVersion: this.currentVersion,
    };
  }

  async decrypt(ciphertext: Uint8Array, aad: string, keyVersion: number): Promise<string> {
    const key = this.keys.get(keyVersion);
    if (!key) throw new Error(`versão de chave desconhecida: ${keyVersion}`);
    const buf = Buffer.from(ciphertext);
    if (buf.length < NONCE_LEN + TAG_LEN) throw new Error('ciphertext malformado');

    const nonce = buf.subarray(0, NONCE_LEN);
    const tag = buf.subarray(buf.length - TAG_LEN);
    const body = buf.subarray(NONCE_LEN, buf.length - TAG_LEN);

    const decipher = createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
  }
}

/** Comparação em tempo constante para hashes de tokens/API keys. */
export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
