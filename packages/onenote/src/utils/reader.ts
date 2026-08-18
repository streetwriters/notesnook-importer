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

import { toBase64 } from "./base64";

export { toBase64 };

export type BinaryEncoding =
  | "utf-8"
  | "utf8"
  | "utf16le"
  | "ascii"
  | "latin1"
  | "hex"
  | "base64";


const UTF8_DECODER = new TextDecoder("utf-8");
const UTF16LE_DECODER = new TextDecoder("utf-16le");
const ASCII_DECODER = new TextDecoder("latin1");
const HEX_CHARS = "0123456789abcdef";

/**
 * A binary reader over a Uint8Array with a position and optional limit.
 * The API mirrors Node's BufferReader with little-endian defaults.
 */
export class BufferReader {
  littleEndian: boolean;
  private readonly buffer: Uint8Array;
  private readonly view: DataView;
  private pos = 0;
  private limit = -1;

  /**
   *
   * @param buf buffer to read
   * @param littleEndian Whether the endian when endian is not specified is little endian
   */
  constructor(buffer: Uint8Array, littleEndian = true) {
    this.buffer = buffer;
    this.view = new DataView(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength
    );
    this.littleEndian = littleEndian;
  }

  private stringify(obj: { [key: string]: number }) {
    const ary = [];
    for (const key in obj) {
      ary.push(`${key}: ${obj[key]}`);
    }
    return `{ ${ary.join(", ")} }`;
  }

  /**
   * Restrict position to read.
   * @param limit Limit
   * @throws RangeError
   */
  setLimit(limit: number) {
    if (limit < 0 || this.buffer.byteLength < limit) {
      throw new RangeError(
        `Position out of range of buffer. setLimit: ${this.stringify({
          limit: limit,
          bufferLength: this.buffer.byteLength
        })}`
      );
    }

    this.limit = limit;
    return this;
  }

  /**
   * Reset Limit.
   */
  resetLimit() {
    this.limit = -1;
    return this;
  }

  /**
   * Get Limit.
   */
  getLimit() {
    if (this.limit >= 0) {
      return this.limit;
    } else {
      return null;
    }
  }

  /**
   * Return the current reading position.
   */
  getPos() {
    return this.pos;
  }

  eob(): boolean {
    return this.pos >= this.buffer.byteLength;
  }

  length(): number {
    return this.buffer.byteLength;
  }

  /**
   * Move the current reading position.
   * @param pos Position
   * @throws RangeError
   */
  seek(pos: number) {
    if (pos < 0 || this.buffer.byteLength < pos) {
      throw new RangeError(
        `Position out of range of buffer. seek: ${this.stringify({
          pos: pos,
          bufferLength: this.buffer.byteLength
        })}`
      );
    }

    this.pos = pos;
    return this;
  }

  /**
   * Skip a specific length
   * @param nByte skip length
   * @throws RangeError
   */
  skip(nByte: number) {
    this.checkPos(this.pos, nByte, "skip");
    this.pos += nByte;
    return this;
  }

  private checkPos(pos: number, readByte: number, method: string) {
    if (this.limit >= 0 && pos + readByte > this.limit) {
      throw new RangeError(
        `Position exceeds limit. ${method}: ${this.stringify({
          pos: pos,
          limit: this.limit,
          readByte: readByte
        })}`
      );
    }

    if (pos + readByte > this.buffer.byteLength) {
      throw new RangeError(
        `Position exceeds buffer length. ${method}: ${this.stringify({
          pos: pos,
          bufferLength: this.buffer.byteLength,
          readByte: readByte
        })}`
      );
    }
  }

  /**
   * Read as an encoded string.
   * @param length Length to read
   * @throws RangeError
   */
  readString(length: number, encoding: BinaryEncoding): string {
    this.checkPos(this.pos, length, "readString");
    const bytes = this.buffer.subarray(this.pos, this.pos + length);
    this.pos += length;
    return decode(bytes, encoding);
  }

  /**
   * Slice buffer.
   * @param length Length to read
   * @throws RangeError
   */
  readBuffer(length: number): Uint8Array {
    this.checkPos(this.pos, length, "readBuffer");
    const r = this.buffer.subarray(this.pos, this.pos + length);
    this.pos += length;
    return r;
  }

  /**
   * @throws RangeError
   */
  readInt8() {
    this.checkPos(this.pos, 1, "readInt8");
    const r = this.view.getInt8(this.pos);
    this.pos += 1;
    return r;
  }

  /**
   * @throws RangeError
   */
  readUInt8() {
    this.checkPos(this.pos, 1, "readUInt8");
    const r = this.view.getUint8(this.pos);
    this.pos += 1;
    return r;
  }

  /**
   * @throws RangeError
   */
  readInt16() {
    return this.littleEndian ? this.readInt16LE() : this.readInt16BE();
  }

  /**
   * @throws RangeError
   */
  readInt16LE() {
    this.checkPos(this.pos, 2, "readInt16LE");
    const r = this.view.getInt16(this.pos, true);
    this.pos += 2;
    return r;
  }

  /**
   * @throws RangeError
   */
  readInt16BE() {
    this.checkPos(this.pos, 2, "readInt16BE");
    const r = this.view.getInt16(this.pos, false);
    this.pos += 2;
    return r;
  }

  /**
   * @throws RangeError
   */
  readUInt16() {
    return this.littleEndian ? this.readUInt16LE() : this.readUInt16BE();
  }

  /**
   * @throws RangeError
   */
  readUInt16LE() {
    this.checkPos(this.pos, 2, "readUInt16LE");
    const r = this.view.getUint16(this.pos, true);
    this.pos += 2;
    return r;
  }

  /**
   * @throws RangeError
   */
  readUInt16BE() {
    this.checkPos(this.pos, 2, "readUInt16BE");
    const r = this.view.getUint16(this.pos, false);
    this.pos += 2;
    return r;
  }

  /**
   * @throws RangeError
   */
  readInt32() {
    return this.littleEndian ? this.readInt32LE() : this.readInt32BE();
  }

  /**
   * @throws RangeError
   */
  readInt32LE() {
    this.checkPos(this.pos, 4, "readInt32LE");
    const r = this.view.getInt32(this.pos, true);
    this.pos += 4;
    return r;
  }

  /**
   * @throws RangeError
   */
  readInt32BE() {
    this.checkPos(this.pos, 4, "readInt32BE");
    const r = this.view.getInt32(this.pos, false);
    this.pos += 4;
    return r;
  }

  /**
   * @throws RangeError
   */
  readUInt32() {
    return this.littleEndian ? this.readUInt32LE() : this.readUInt32BE();
  }

  /**
   * @throws RangeError
   */
  readUInt32LE() {
    this.checkPos(this.pos, 4, "readUInt32LE");
    const r = this.view.getUint32(this.pos, true);
    this.pos += 4;
    return r;
  }

  /**
   * @throws RangeError
   */
  readUInt32BE() {
    this.checkPos(this.pos, 4, "readUInt32BE");
    const r = this.view.getUint32(this.pos, false);
    this.pos += 4;
    return r;
  }

  /**
   * Reads a 64-bit unsigned integer. Values are returned as a JavaScript
   * number which is exact for all values below 2^53 (which covers all
   * realistic file sizes and positions).
   * @throws RangeError
   */
  readUInt64() {
    return this.littleEndian ? this.readUInt64LE() : this.readUInt64BE();
  }

  /**
   * @throws RangeError
   */
  readUInt64LE() {
    this.checkPos(this.pos, 8, "readUInt64LE");
    const lo = this.view.getUint32(this.pos, true);
    const hi = this.view.getUint32(this.pos + 4, true);
    this.pos += 8;
    return lo + hi * 4294967296;
  }

  /**
   * @throws RangeError
   */
  readUInt64BE() {
    this.checkPos(this.pos, 8, "readUInt64BE");
    const hi = this.view.getUint32(this.pos, false);
    const lo = this.view.getUint32(this.pos + 4, false);
    this.pos += 8;
    return lo + hi * 4294967296;
  }

  /**
   * @throws RangeError
   */
  readInt64() {
    return this.littleEndian ? this.readInt64LE() : this.readInt64BE();
  }

  /**
   * @throws RangeError
   */
  readInt64LE() {
    this.checkPos(this.pos, 8, "readInt64LE");
    const lo = this.view.getUint32(this.pos, true);
    const hi = this.view.getInt32(this.pos + 4, true);
    this.pos += 8;
    return lo + hi * 4294967296;
  }

  /**
   * @throws RangeError
   */
  readInt64BE() {
    this.checkPos(this.pos, 8, "readInt64BE");
    const hi = this.view.getInt32(this.pos, false);
    const lo = this.view.getUint32(this.pos + 4, false);
    this.pos += 8;
    return lo + hi * 4294967296;
  }

  /**
   * @throws RangeError
   */
  readFloat32() {
    return this.littleEndian ? this.readFloat32LE() : this.readFloat32BE();
  }

  /**
   * @throws RangeError
   */
  readFloat32LE() {
    this.checkPos(this.pos, 4, "readFloat32LE");
    const r = this.view.getFloat32(this.pos, true);
    this.pos += 4;
    return r;
  }

  /**
   * @throws RangeError
   */
  readFloat32BE() {
    this.checkPos(this.pos, 4, "readFloat32BE");
    const r = this.view.getFloat32(this.pos, false);
    this.pos += 4;
    return r;
  }

  /**
   * @throws RangeError
   */
  readFloat64() {
    return this.littleEndian ? this.readFloat64LE() : this.readFloat64BE();
  }

  /**
   * @throws RangeError
   */
  readFloat64LE() {
    this.checkPos(this.pos, 8, "readFloat64LE");
    const r = this.view.getFloat64(this.pos, true);
    this.pos += 8;
    return r;
  }

  /**
   * @throws RangeError
   */
  readFloat64BE() {
    this.checkPos(this.pos, 8, "readFloat64BE");
    const r = this.view.getFloat64(this.pos, false);
    this.pos += 8;
    return r;
  }
}

export function decode(bytes: Uint8Array, encoding: BinaryEncoding): string {
  switch (encoding) {
    case "utf-8":
    case "utf8":
      return UTF8_DECODER.decode(bytes);
    case "utf16le":
      return UTF16LE_DECODER.decode(bytes);
    case "ascii":
    case "latin1":
      return ASCII_DECODER.decode(bytes);
    case "hex":
      return toHex(bytes);
    case "base64":
      return toBase64(bytes);
  }
}

export function toHex(bytes: Uint8Array): string {
  let output = "";
  for (const byte of bytes) {
    output += HEX_CHARS[byte >> 4];
    output += HEX_CHARS[byte & 0x0f];
  }
  return output;
}

export function fromHex(hex: string): Uint8Array {
  const clean = hex.length % 2 === 0 ? hex : `0${hex}`;
  const output = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    output[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  return output;
}
