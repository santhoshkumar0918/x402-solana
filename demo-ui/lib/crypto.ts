// Encryption/Decryption utilities using Web Crypto API

/**
 * Generate a random AES-256 encryption key
 */
export async function generateEncryptionKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Export encryption key to hex string
 */
export async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', key);
  return Array.from(new Uint8Array(exported))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Import encryption key from hex string
 */
export async function importKey(keyHex: string): Promise<CryptoKey> {
  const keyBytes = new Uint8Array(
    keyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
  );
  
  return await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt file content
 */
export async function encryptFile(
  file: File,
  key: CryptoKey
): Promise<{ encrypted: ArrayBuffer; iv: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
  const fileData = await file.arrayBuffer();

  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    fileData
  );

  return { encrypted, iv };
}

/**
 * Decrypt file content
 */
export async function decryptFile(
  encryptedData: ArrayBuffer,
  iv: Uint8Array,
  key: CryptoKey
): Promise<ArrayBuffer> {
  return await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    encryptedData
  );
}

/**
 * Encrypt string content
 */
export async function encryptString(
  text: string,
  key: CryptoKey
): Promise<{ encrypted: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const data = encoder.encode(text);

  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    data
  );

  return {
    encrypted: Array.from(new Uint8Array(encrypted))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(''),
    iv: Array.from(iv)
      .map(b => b.toString(16).padStart(2, '0'))
      .join(''),
  };
}

/**
 * Decrypt string content
 */
export async function decryptString(
  encryptedHex: string,
  ivHex: string,
  key: CryptoKey
): Promise<string> {
  const encryptedBytes = new Uint8Array(
    encryptedHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
  );
  const iv = new Uint8Array(
    ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
  );

  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(iv.buffer, iv.byteOffset, iv.byteLength),
    },
    key,
    new Uint8Array(encryptedBytes.buffer, encryptedBytes.byteOffset, encryptedBytes.byteLength)
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * Hash content using SHA-256
 */
export async function hashContent(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
