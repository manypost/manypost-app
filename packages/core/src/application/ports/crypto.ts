/**
 * Port de criptografia de tokens at-rest (SPEC_DATA §5).
 * Implementação exigida: AES-256-GCM, nonce aleatório por registro, AAD = id do canal,
 * chave dedicada ENCRYPTION_KEY, com key_version para rotação.
 */
export interface CryptoService {
  encrypt(plaintext: string, aad: string): Promise<{ ciphertext: Uint8Array; keyVersion: number }>;
  decrypt(ciphertext: Uint8Array, aad: string, keyVersion: number): Promise<string>;
}
