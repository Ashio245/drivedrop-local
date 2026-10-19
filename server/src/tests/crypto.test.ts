import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../lib/crypto.js';

describe('AES-256-GCM Token Encryption', () => {
  it('encrypts and decrypts secret strings faithfully', () => {
    const secretToken = 'ya29.a0AfH6SMA...sample_google_refresh_token_12345';
    const ciphertext = encrypt(secretToken);

    expect(ciphertext).not.toBe(secretToken);
    expect(ciphertext.length).toBeGreaterThan(32);

    const decrypted = decrypt(ciphertext);
    expect(decrypted).toBe(secretToken);
  });

  it('produces different ciphertexts for the same plaintext due to random IV', () => {
    const text = 'test_secret_payload';
    const cipher1 = encrypt(text);
    const cipher2 = encrypt(text);

    expect(cipher1).not.toBe(cipher2);
    expect(decrypt(cipher1)).toBe(text);
    expect(decrypt(cipher2)).toBe(text);
  });

  it('fails decryption if ciphertext or authentication tag is tampered with', () => {
    const text = 'sensitive_data';
    const ciphertext = encrypt(text);

    // Tamper with one character in the base64 string
    const tampered = ciphertext.substring(0, ciphertext.length - 2) + 'AA';

    expect(() => decrypt(tampered)).toThrow();
  });
});
