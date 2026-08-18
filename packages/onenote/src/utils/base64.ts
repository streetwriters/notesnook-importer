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

const BASE64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function toBase64(bytes: Uint8Array): string {
  let output = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b3 = i + 2 < bytes.length ? bytes[i + 2] : 0;

    output += BASE64_CHARS[b1 >> 2];
    output += BASE64_CHARS[((b1 & 0x03) << 4) | (b2 >> 4)];
    output +=
      i + 1 < bytes.length
        ? BASE64_CHARS[((b2 & 0x0f) << 2) | (b3 >> 6)]
        : "=";
    output += i + 2 < bytes.length ? BASE64_CHARS[b3 & 0x3f] : "=";
  }
  return output;
}

export function fromBase64(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/=]/g, "");
  const output = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let bytesWritten = 0;
  let buffer = 0;
  let bitsInBuffer = 0;

  for (let i = 0; i < clean.length; ++i) {
    const char = clean[i];
    if (char === "=") break;
    const value = BASE64_CHARS.indexOf(char);
    if (value === -1) continue;

    buffer = (buffer << 6) | value;
    bitsInBuffer += 6;

    if (bitsInBuffer >= 8) {
      bitsInBuffer -= 8;
      output[bytesWritten++] = (buffer >> bitsInBuffer) & 0xff;
    }
  }

  return output.subarray(0, bytesWritten);
}
