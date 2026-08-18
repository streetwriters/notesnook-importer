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

import { BinaryReader } from "./reader";

export interface MediaEntry {
  bindId: number;
  filename: string;
  hash: string;
  refCount: number;
  modifiedTime: number;
  isFileAttached: boolean;
  data: Uint8Array | null;
}

export interface MediaInfo {
  formatVersion: number;
  entries: MediaEntry[];
}

export function parseMediaInfo(bytes: Uint8Array): MediaInfo {
  const reader = new BinaryReader(bytes);
  const formatVersion = reader.u32();
  const count = reader.u16();
  if (count > 4096) throw new Error(`Invalid media entry count: ${count}`);

  const entries: MediaEntry[] = [];
  for (let i = 0; i < count; ++i) {
    const entrySize = reader.u32();
    const entryEnd = reader.position + entrySize;
    const bindId = reader.u32();
    const filename = reader.utf16() ?? "";
    const hash = new TextDecoder("ascii").decode(reader.bytes(64)).trim();
    const refCount = reader.u16();
    const modifiedTime = reader.u64() / 1000;
    const isFileAttached = !!reader.u8();
    entries.push({
      bindId,
      filename,
      hash,
      refCount,
      modifiedTime,
      isFileAttached,
      data: null
    });
    reader.seek(entryEnd);
  }

  return { formatVersion, entries };
}

export interface SpiHeader {
  formatFamily: number;
  width: number;
  height: number;
  imagePacketSize: number;
  sizeHint: number;
}

/**
 * Parses the packet framing of a Samsung `.spi` painting/cache file.
 * The payload itself is a proprietary raster encoding and is not decoded.
 */
export function parseSpiHeader(bytes: Uint8Array): SpiHeader | null {
  const reader = new BinaryReader(bytes);
  const headerPacketSize = reader.u32();
  if (
    headerPacketSize !== 20 ||
    reader.position + headerPacketSize > bytes.byteLength
  )
    return null;

  reader.skip(2); // tag 0xAA01
  reader.skip(2); // reserved
  const recordSize = reader.u16();
  reader.skip(2); // record reserved
  const formatFamily = reader.u32();
  const width = reader.u16();
  const height = reader.u16();
  reader.skip(2); // texture width units
  reader.skip(2); // fixed 0x00E0
  if (recordSize !== 20) return null;

  const imagePacketSize = reader.u32();
  if (reader.position + imagePacketSize > bytes.byteLength) return null;
  reader.skip(2); // tag 0xAA02
  reader.skip(2); // reserved
  const sizeHint = reader.u32();

  return { formatFamily, width, height, imagePacketSize, sizeHint };
}
