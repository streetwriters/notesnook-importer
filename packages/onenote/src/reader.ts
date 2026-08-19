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

import {
  CBFormat,
  FileChunkReference,
  STPFormat
} from "./utils/file-chunk-reference";

export { CBFormat, FileChunkReference, STPFormat } from "./utils/file-chunk-reference";
import { ExtendedGUID, GUID } from "./utils/guid";
import { BufferReader, decode } from "./utils/reader";

export type CompactID = {
  n: number;
  guidIndex: number;
};

export type JCID = {
  id: number;
  index: number;
  isBinary: boolean;
  isPropertySet: boolean;
  isGraphNode: boolean;
  isFileData: boolean;
  isReadOnly: boolean;
};

export class OneNoteReader {
  readonly #reader: BufferReader;
  constructor(readonly buffer: Uint8Array) {
    this.#reader = new BufferReader(buffer);
  }

  get position() {
    return this.#reader.getPos();
  }

  seek(pos: number) {
    this.#reader.seek(pos);
  }

  trySeek(pos: number): boolean {
    if (pos < 0 || this.buffer.byteLength < pos) return false;
    this.#reader.seek(pos);
    return true;
  }

  deserializeGUID(): GUID {
    return GUID.fromBuffer(this.#reader.readBuffer(16));
  }

  deserializeCompactId(): CompactID {
    const data = this.deserializeInt();
    return { n: data & 0xff, guidIndex: data >> 8 };
  }

  deserializeJCID(): JCID {
    const jcid = this.deserializeInt();
    return {
      id: jcid,
      index: jcid & 0xffff,
      isBinary: ((jcid >> 16) & 0x1) === 1,
      isPropertySet: ((jcid >> 17) & 0x1) === 1,
      isGraphNode: ((jcid >> 18) & 0x1) === 1,
      isFileData: ((jcid >> 19) & 0x1) === 1,
      isReadOnly: ((jcid >> 20) & 0x1) === 1
    };
  }

  deserializeInt() {
    return this.#reader.readUInt32LE();
  }

  deserializeShort() {
    const c1: number = this.#reader.readUInt8();
    const c2: number = this.#reader.readUInt8();
    return (c1 & 0xff) + ((c2 & 0xff) << 8);
  }

  deserializeLong() {
    return this.#reader.readUInt64LE();
  }

  deserializeChar() {
    const char = this.#reader.readUInt8();
    return String.fromCharCode(char);
  }

  deserializeByte() {
    return this.#reader.readUInt8();
  }

  deserializeCharArray(length: number) {
    return decode(this.deserializeBytes(length), "utf-8");
  }

  deserializeBytes(length: number) {
    return this.#reader.readBuffer(length);
  }

  deserializeExtendedGUID() {
    const guid: GUID = this.deserializeGUID();
    const n: number = this.deserializeInt();
    return new ExtendedGUID(guid, n);
  }

  deserializeFileChunkReference<
    TStpFormat extends STPFormat,
    TCbFormat extends CBFormat
  >(stpFormat: TStpFormat, cbFormat: TCbFormat) {
    return this.readFileChunkReference(stpFormat, cbFormat);
  }

  readFileChunkReference32() {
    return this.readFileChunkReference(STPFormat.UINT32, CBFormat.UINT32);
  }

  readFileChunkReference64x32() {
    return this.readFileChunkReference(STPFormat.ULONG64, CBFormat.UINT32);
  }

  readFileChunkReference<
    TStpFormat extends STPFormat,
    TCbFormat extends CBFormat
  >(stpFormat: TStpFormat, cbFormat: TCbFormat) {
    return new FileChunkReference(this, this.#reader, stpFormat, cbFormat);
  }
}
