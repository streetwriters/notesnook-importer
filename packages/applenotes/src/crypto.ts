/*
This file is part of the Notesnook project (https://notesnook.com/)

Copyright (C) 2023 Streetwriters (Private) Limited

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

export type AppleNotesCryptoData = {
  /** PBKDF2 salt. */
  salt: Uint8Array;
  /** PBKDF2 iteration count. */
  iterations: number;
  /** RFC 3394 AES key-wrapped content key. */
  wrappedKey: Uint8Array;
  /** AES-GCM initialization vector. */
  iv: Uint8Array;
  /** AES-GCM authentication tag. */
  tag: Uint8Array;
  /** The encrypted note body. */
  ciphertext: Uint8Array;
  /** Additional authenticated data (the note metadata plist for modern notes). */
  aad?: Uint8Array;
};

/**
 * Decrypts a password-protected Apple Notes body.
 *
 * Apple's scheme (reverse-engineered by the ciofecaforensics project):
 *   1. key_encrypting_key = PBKDF2-HMAC-SHA256(password, salt, iterations)
 *   2. content_key         = AES-KW (RFC 3394) unwrap(wrapped_key, key_encrypting_key)
 *   3. plaintext           = AES-GCM decrypt(content_key, iv, ciphertext, tag)
 *
 * The KEK (and content key) size is derived from the wrapped key: RFC 3394
 * wraps a key by adding 8 bytes, so a 24-byte wrapped key holds a 16-byte key
 * (older notes) and a 40-byte wrapped key holds a 32-byte key (newer notes).
 *
 * The plaintext is a gzip-compressed NoteStoreProto, which the caller
 * decompresses and decodes like any other note body.
 */
export async function decryptAppleNotes(
  password: string,
  data: AppleNotesCryptoData
): Promise<Uint8Array> {
  const subtle = crypto.subtle;
  const encoder = new TextEncoder();

  const keyBits = (data.wrappedKey.length - 8) * 8;

  // 1. Derive the key-encrypting key from the password.
  const passwordKey = await subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const keyEncryptingKey = await subtle.deriveBits(
    { name: "PBKDF2", salt: data.salt, iterations: data.iterations, hash: "SHA-256" },
    passwordKey,
    keyBits
  );

  // 2. Unwrap the content key.
  const kek = await subtle.importKey("raw", keyEncryptingKey, "AES-KW", false, [
    "unwrapKey"
  ]);
  const contentKey = await subtle.unwrapKey(
    "raw",
    data.wrappedKey,
    kek,
    { name: "AES-KW" },
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  // 3. Decrypt. WebCrypto expects the authentication tag appended to the
  // ciphertext, while Apple stores it separately.
  const ciphertextWithTag = new Uint8Array(
    data.ciphertext.byteLength + data.tag.byteLength
  );
  ciphertextWithTag.set(data.ciphertext, 0);
  ciphertextWithTag.set(data.tag, data.ciphertext.byteLength);

  const algorithm: AesGcmParams = { name: "AES-GCM", iv: data.iv, tagLength: 128 };
  if (data.aad) algorithm.additionalData = data.aad;

  const plaintext = await subtle.decrypt(algorithm, contentKey, ciphertextWithTag);

  return new Uint8Array(plaintext);
}
