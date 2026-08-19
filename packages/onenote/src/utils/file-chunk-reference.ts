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

import { OneNoteReader } from "../reader";
import { BufferReader } from "./reader";

export enum CBFormat {
  UINT32 = 0,
  ULONG64 = 1,
  UINT8_COMPRESSED = 2,
  UINT16_COMPRESSED = 3
}

export enum STPFormat {
  ULONG64 = 0,
  UINT32 = 1,
  UINT16 = 2,
  UINT32_COMPRESSED = 3
}

export function StpFormatFromNumber(number: number) {
  if (!STPFormat[number])
    throw new Error(
      `Invalid stpFormat. Expected one of 0, 1, 2, 3 but got ${number}.`
    );
  return number as STPFormat;
}

export function CbFormatFromNumber(number: number) {
  if (!CBFormat[number])
    throw new Error(
      `Invalid cbFormat. Expected one of 0, 1, 2, 3 but got ${number}.`
    );
  return number as CBFormat;
}

/**
 * Values considered "invalid" for each STP format per [MS-ONESTORE] 2.2.1.
 * ULONG64 uses the nearest representable double to 2^64 - 1; reading an
 * all-ones UINT64 produces the same rounded double so equality still holds.
 */
const STPInvalidIntegers = {
  [STPFormat.ULONG64]: 0xffffffffffffffff,
  [STPFormat.UINT32]: 0xffffffff,
  [STPFormat.UINT16]: 0x7fff8,
  [STPFormat.UINT32_COMPRESSED]: 0x7fffffff8
} as const;

export class FileChunkReference<
  TStpFormat extends STPFormat | unknown = unknown,
  TCbFormat extends CBFormat | unknown = unknown
> {
  readonly stp: number;
  readonly cb: number;

  constructor(
    private readonly reader: OneNoteReader,
    buffer: BufferReader,
    private readonly stpFormat: TStpFormat,
    private readonly cbFormat: TCbFormat
  ) {
    this.stp =
      stpFormat === STPFormat.ULONG64
        ? buffer.readUInt64()
        : stpFormat === STPFormat.UINT32
        ? buffer.readUInt32()
        : stpFormat === STPFormat.UINT16
        ? buffer.readUInt16() * 8
        : stpFormat === STPFormat.UINT32_COMPRESSED
        ? buffer.readUInt32() * 8
        : 0;

    this.cb =
      cbFormat === CBFormat.UINT32
        ? buffer.readUInt32()
        : cbFormat === CBFormat.ULONG64
        ? buffer.readUInt64()
        : cbFormat === CBFormat.UINT8_COMPRESSED
        ? buffer.readUInt8() * 8
        : cbFormat === CBFormat.UINT16_COMPRESSED
        ? buffer.readUInt16() * 8
        : 0;
  }

  get isNil() {
    const INVALID = STPInvalidIntegers[this.stpFormat as STPFormat];
    const isStpNil =
      this.stpFormat === STPFormat.ULONG64
        ? this.stp === INVALID
        : (this.stp & INVALID) === INVALID;
    return isStpNil && this.cb === 0;
  }

  get isZero() {
    return this.stp === 0 && this.cb === 0;
  }

  is64x32(): this is FileChunkReference<STPFormat.ULONG64, CBFormat.UINT32> {
    return (
      this.stpFormat === STPFormat.ULONG64 && this.cbFormat === CBFormat.UINT32
    );
  }

  seek() {
    this.reader.seek(this.stp);
  }
}

export class FileChunkReference32 extends FileChunkReference<
  STPFormat.UINT32,
  CBFormat.UINT32
> {}

export class FileChunkReference64x32 extends FileChunkReference<
  STPFormat.ULONG64,
  CBFormat.UINT32
> {}
