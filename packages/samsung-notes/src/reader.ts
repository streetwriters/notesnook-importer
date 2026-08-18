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

const decoder = new TextDecoder("utf-16le");

export class BinaryReader {
  private view: DataView;
  private _position = 0;

  constructor(private readonly buffer: Uint8Array) {
    this.view = new DataView(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength
    );
  }

  get position() {
    return this._position;
  }

  get size() {
    return this.buffer.byteLength;
  }

  get eof() {
    return this._position >= this.buffer.byteLength;
  }

  seek(position: number) {
    if (position < 0 || position > this.buffer.byteLength)
      throw new RangeError(
        `seek position ${position} out of range (0..${this.buffer.byteLength}).`
      );
    this._position = position;
    return this;
  }

  skip(bytes: number) {
    this.seek(this._position + bytes);
    return this;
  }

  u8() {
    const value = this.view.getUint8(this._position);
    this._position += 1;
    return value;
  }

  i8() {
    const value = this.view.getInt8(this._position);
    this._position += 1;
    return value;
  }

  u16() {
    const value = this.view.getUint16(this._position, true);
    this._position += 2;
    return value;
  }

  i16() {
    const value = this.view.getInt16(this._position, true);
    this._position += 2;
    return value;
  }

  u32() {
    const value = this.view.getUint32(this._position, true);
    this._position += 4;
    return value;
  }

  i32() {
    const value = this.view.getInt32(this._position, true);
    this._position += 4;
    return value;
  }

  u64(): number {
    const value = this.view.getBigUint64(this._position, true);
    this._position += 8;
    return Number(value);
  }

  i64(): number {
    const value = this.view.getBigInt64(this._position, true);
    this._position += 8;
    return Number(value);
  }

  f32() {
    const value = this.view.getFloat32(this._position, true);
    this._position += 4;
    return value;
  }

  f64() {
    const value = this.view.getFloat64(this._position, true);
    this._position += 8;
    return value;
  }

  bytes(length: number) {
    if (length < 0) throw new RangeError(`negative length ${length}.`);
    const value = this.buffer.slice(this._position, this._position + length);
    this._position += length;
    return value;
  }

  /**
   * UTF-16LE string prefixed by a u16 character count.
   */
  utf16() {
    const length = this.u16();
    if (length === 0xffff) return null;
    return this.readUtf16(length);
  }

  /**
   * UTF-16LE string prefixed by a u32 character count.
   */
  utf16Long() {
    const length = this.u32();
    if (length === 0xffffffff) return null;
    return this.readUtf16(length);
  }

  private readUtf16(length: number) {
    if (length <= 0) {
      this._position += length * 2;
      return "";
    }
    const value = decoder.decode(
      this.buffer.subarray(this._position, this._position + length * 2)
    );
    this._position += length * 2;
    return value;
  }

  rest() {
    const value = this.buffer.slice(this._position);
    this._position = this.buffer.byteLength;
    return value;
  }
}
