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

/**
 * MS-OFFCRYPTO encryption support for OneNote sections.
 *
 * Implements the password-based key derivation and AES-256-CBC decryption
 * described in [MS-OFFCRYPTO] 2.3.4.7 (ECMA-376 Agile Encryption).
 *
 * The encryption metadata (algorithm, salts, spin count, encrypted verifier
 * and encrypted key) is stored in an XML blob inside the
 * `ObjectDataEncryptionKeyV2FNDX` node of each encrypted object space.
 */

import { fromBase64 } from "./utils/base64.js";

// ---------------------------------------------------------------------------
// Encryption metadata parsed from the XML blob
// ---------------------------------------------------------------------------

export interface EncryptionInfo {
  /** Cipher algorithm, e.g. "AES" */
  cipherAlgorithm: string;
  /** Cipher chaining, e.g. "ChainingModeCBC" */
  cipherChaining: string;
  /** Hash algorithm, e.g. "SHA512" */
  hashAlgorithm: string;
  /** Key size in bits, e.g. 256 */
  keyBits: number;
  /** Block size in bytes, e.g. 16 */
  blockSize: number;
  /** Hash output size in bytes, e.g. 64 */
  hashSize: number;
  /** Salt for the data key, base64-encoded */
  saltValue: Uint8Array;
  /** Spin count for the password key derivation, e.g. 100000 */
  spinCount: number;
  /** Salt for the password key derivation, base64-encoded */
  passwordSalt: Uint8Array;
  /** Encrypted verifier hash input, base64-encoded */
  encryptedVerifierHashInput: Uint8Array;
  /** Encrypted verifier hash value, base64-encoded */
  encryptedVerifierHashValue: Uint8Array;
  /** Encrypted data encryption key, base64-encoded */
  encryptedKeyValue: Uint8Array;
}

/**
 * Parse the encryption XML blob that is stored in the
 * `ObjectDataEncryptionKeyV2FNDX` reference.
 */
export function parseEncryptionXml(xml: string): EncryptionInfo {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");
  const keyData = doc.querySelector("keyData");
  const encryptedKey = doc.querySelector("encryptedKey");

  if (!keyData || !encryptedKey) {
    throw new Error("Invalid encryption XML: missing keyData or encryptedKey");
  }

  return {
    cipherAlgorithm: keyData.getAttribute("cipherAlgorithm") || "AES",
    cipherChaining:
      keyData.getAttribute("cipherChaining") || "ChainingModeCBC",
    hashAlgorithm: keyData.getAttribute("hashAlgorithm") || "SHA512",
    keyBits: parseInt(keyData.getAttribute("keyBits") || "256", 10),
    blockSize: parseInt(keyData.getAttribute("blockSize") || "16", 10),
    hashSize: parseInt(keyData.getAttribute("hashSize") || "64", 10),
    saltValue: fromBase64(keyData.getAttribute("saltValue") || ""),
    spinCount: parseInt(encryptedKey.getAttribute("spinCount") || "100000", 10),
    passwordSalt: fromBase64(encryptedKey.getAttribute("saltValue") || ""),
    encryptedVerifierHashInput: fromBase64(
      encryptedKey.getAttribute("encryptedVerifierHashInput") || ""
    ),
    encryptedVerifierHashValue: fromBase64(
      encryptedKey.getAttribute("encryptedVerifierHashValue") || ""
    ),
    encryptedKeyValue: fromBase64(
      encryptedKey.getAttribute("encryptedKeyValue") || ""
    )
  };
}

// ---------------------------------------------------------------------------
// MS-OFFCRYPTO key derivation (Agile Encryption)
// ---------------------------------------------------------------------------

/**
 * Derive an intermediate key from a password using the MS-OFFCRYPTO Agile
 * Encryption key derivation algorithm ([MS-OFFCRYPTO] 2.3.4.7).
 *
 * Returns the derived key bytes (keyBits / 8 bytes long).
 */
export async function deriveKeyFromPassword(
  password: string,
  info: EncryptionInfo
): Promise<Uint8Array> {
  const keyBytes = info.keyBits / 8;

  // Step 1: H0 = SHA-512(salt + UTF16LE(password))
  const passwordBytes = encodeUtf16Le(password);
  const h0Input = concat(info.passwordSalt, passwordBytes);
  let hash = await sha512(h0Input);

  // Step 2: iterate spinCount times
  // Hn = SHA-512(iterator_bytes(n) + H(n-1))
  for (let i = 0; i < info.spinCount; i++) {
    const iteratorBytes = uint32LeBytes(i);
    hash = await sha512(concat(iteratorBytes, hash));
  }

  // Step 3: Hfinal = SHA-512(iterator_bytes(0x00000000) + H(spinCount))
  //          + 0x00000000 block key bytes appended
  const blockKey = uint32LeBytes(0);
  const hFinal = await sha512(concat(blockKey, hash));

  // Truncate to keyBytes
  return hFinal.slice(0, keyBytes);
}

/**
 * Verify that the given password is correct by decrypting the verifier
 * hash input and value.
 *
 * Returns `true` if the password is correct.
 */
export async function verifyPassword(
  password: string,
  info: EncryptionInfo
): Promise<boolean> {
  try {
    const intermediateKey = await deriveKeyFromPassword(password, info);
    const key = intermediateKey.slice(0, info.keyBits / 8);

    // Decrypt the verifier hash input
    const verifierInput = await aesCbcDecrypt(
      info.encryptedVerifierHashInput,
      key
    );

    // Compute SHA-512 of the decrypted input
    const verifierHash = await sha512(verifierInput);

    // Decrypt the verifier hash value
    const decryptedVerifierHash = await aesCbcDecrypt(
      info.encryptedVerifierHashValue,
      key
    );

    // Compare: the decrypted verifier hash should be a prefix of the
    // computed hash (truncated to hashSize)
    const expected = decryptedVerifierHash;
    const actual = verifierHash.slice(0, expected.length);

    return constantTimeEqual(expected, actual);
  } catch {
    return false;
  }
}

/**
 * Decrypt the data encryption key using the password-derived intermediate key.
 */
export async function decryptDataKey(
  password: string,
  info: EncryptionInfo
): Promise<Uint8Array> {
  const intermediateKey = await deriveKeyFromPassword(password, info);
  const key = intermediateKey.slice(0, info.keyBits / 8);
  return aesCbcDecrypt(info.encryptedKeyValue, key);
}

/**
 * Decrypt a block of data (an encrypted object's property set) using the
 * data encryption key. The ciphertext is expected to have a 16-byte IV
 * prepended (standard AES-CBC with PKCS#7 padding).
 */
export async function decryptObjectData(
  ciphertext: Uint8Array,
  dataKey: Uint8Array
): Promise<Uint8Array> {
  return aesCbcDecrypt(ciphertext, dataKey);
}

// ---------------------------------------------------------------------------
// Crypto helpers
// ---------------------------------------------------------------------------

async function sha512(data: Uint8Array): Promise<Uint8Array> {
  // Use Web Crypto API (available in both browsers and Node.js 18+)
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.subtle) {
    const hashBuffer = await globalThis.crypto.subtle.digest("SHA-512", data);
    return new Uint8Array(hashBuffer);
  }

  // Fallback: Node.js crypto
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createHash } = require("crypto");
  return createHash("sha512").update(data).digest();
}

async function aesCbcDecrypt(
  ciphertext: Uint8Array,
  key: Uint8Array
): Promise<Uint8Array> {
  // First 16 bytes are the IV, rest is the ciphertext
  if (ciphertext.length < 16) {
    throw new Error("Ciphertext too short (no IV)");
  }
  const iv = ciphertext.slice(0, 16);
  const data = ciphertext.slice(16);

  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.subtle) {
    const cryptoKey = await globalThis.crypto.subtle.importKey(
      "raw",
      key,
      { name: "AES-CBC" },
      false,
      ["decrypt"]
    );
    const decrypted = await globalThis.crypto.subtle.decrypt(
      { name: "AES-CBC", iv },
      cryptoKey,
      data
    );
    // Strip PKCS#7 padding
    const result = new Uint8Array(decrypted);
    return stripPkcs7Padding(result);
  }

  // Fallback: Node.js crypto
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createDecipheriv } = require("crypto");
  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(data)),
    decipher.final()
  ]);
  return stripPkcs7Padding(new Uint8Array(decrypted));
}

function stripPkcs7Padding(data: Uint8Array): Uint8Array {
  if (data.length === 0) return data;
  const padLen = data[data.length - 1];
  if (padLen === 0 || padLen > 16 || padLen > data.length) return data;
  // Verify padding
  for (let i = data.length - padLen; i < data.length; i++) {
    if (data[i] !== padLen) return data; // Invalid padding, return as-is
  }
  return data.slice(0, data.length - padLen);
}

function encodeUtf16Le(str: string): Uint8Array {
  const bytes = new Uint8Array(str.length * 2);
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    bytes[i * 2] = code & 0xff;
    bytes[i * 2 + 1] = (code >> 8) & 0xff;
  }
  return bytes;
}

function uint32LeBytes(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  bytes[0] = value & 0xff;
  bytes[1] = (value >> 8) & 0xff;
  bytes[2] = (value >> 16) & 0xff;
  bytes[3] = (value >> 24) & 0xff;
  return bytes;
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const result = new Uint8Array(a.length + b.length);
  result.set(a, 0);
  result.set(b, a.length);
  return result;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}
