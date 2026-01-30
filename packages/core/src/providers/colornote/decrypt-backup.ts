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

import SparkMD5 from "spark-md5";
import { ColornoteNote } from "./types";

const FIXED_SALT = "ColorNote Fixed Salt";
const HEADER_OFFSET = 28;

function hexToBytes(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function deriveKeyIv(password: string) {
  const passwordBytes = new TextEncoder().encode(password);
  const saltBytes = new TextEncoder().encode(FIXED_SALT);

  const m1Input = new Uint8Array(passwordBytes.length + saltBytes.length);
  m1Input.set(passwordBytes, 0);
  m1Input.set(saltBytes, passwordBytes.length);
  const m1 = hexToBytes(SparkMD5.ArrayBuffer.hash(m1Input.buffer));
  const key = m1;

  const m2Input = new Uint8Array(
    key.length + passwordBytes.length + saltBytes.length
  );
  m2Input.set(key, 0);
  m2Input.set(passwordBytes, key.length);
  m2Input.set(saltBytes, key.length + passwordBytes.length);
  const m2 = hexToBytes(SparkMD5.ArrayBuffer.hash(m2Input.buffer));
  const iv = m2;

  return { key, iv };
}

async function decrypt(encryptedData: Uint8Array, password: string = "0000") {
  if (encryptedData.length < 44) {
    throw new Error("Data is too small to be a valid ColorNote payload.");
  }

  const payload = encryptedData.slice(HEADER_OFFSET);

  const { key, iv } = deriveKeyIv(password);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key.buffer as ArrayBuffer,
    { name: "AES-CBC" },
    false,
    ["decrypt"]
  );

  try {
    const decryptedBytes = await crypto.subtle.decrypt(
      { name: "AES-CBC", iv: iv.buffer as ArrayBuffer },
      cryptoKey,
      payload
    );

    return new TextDecoder("utf-8", { fatal: false }).decode(decryptedBytes);
  } catch {
    throw new Error("Decryption failed. Incorrect password or corrupted file.");
  }
}

function extractJsonObjects(rawText: string) {
  const notes: ColornoteNote[] = [];
  const length = rawText.length;
  let i = 0;

  while (i < length) {
    const startIndex = rawText.indexOf("{", i);
    if (startIndex === -1) break;

    let balance = 0;
    let inQuote = false;
    let escape = false;
    let endIndex = -1;

    for (let j = startIndex; j < length; j++) {
      const char = rawText[j];

      if (escape) {
        escape = false;
        continue;
      }

      if (char === "\\") {
        escape = true;
        continue;
      }

      if (char === '"') {
        inQuote = !inQuote;
        continue;
      }

      if (!inQuote) {
        if (char === "{") {
          balance++;
        } else if (char === "}") {
          balance--;

          if (balance === 0) {
            endIndex = j;
            break;
          }
        }
      }
    }

    if (endIndex !== -1) {
      const candidate = rawText.slice(startIndex, endIndex + 1);

      try {
        const obj = JSON.parse(candidate) as ColornoteNote;
        notes.push(obj);
        i = endIndex + 1;
        continue;
      } catch {
        i = startIndex + 1;
      }
    } else {
      i = startIndex + 1;
    }
  }

  return notes;
}

/**
 * Decrypts a ColorNote backup file.
 * Based on: https://github.com/matheusmatos67/colornote-decryptor-python
 */
export async function decryptBackup(
  backupFileButes: Uint8Array,
  password?: string
): Promise<ColornoteNote[]> {
  const decryptedText = await decrypt(backupFileButes, password);
  const notes = extractJsonObjects(decryptedText);
  return notes;
}
