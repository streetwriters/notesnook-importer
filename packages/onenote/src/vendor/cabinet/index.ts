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
 * A minimal Microsoft Cabinet (CAB) file extractor supporting the formats
 * used by OneNote .onepkg packages (NONE, MSZIP and LZX/LZXD compression).
 *
 * Based on node-mscabinet (https://github.com/jc-lab/node-mscabinet,
 * Apache-2.0) with LZXD support via the lzxd WebAssembly module
 * (https://github.com/Lonami/lzxd, MIT OR Apache-2.0).
 */

import { inflate } from "fflate";
import { Lzxd } from "./lzxd";

const CAB_SIGNATURE = 0x4643534d; // "MSCF"

type CabHeader = {
  headerEnd: number;
  cbCabinet: number;
  coffFiles: number;
  versionMinor: number;
  versionMajor: number;
  cFolders: number;
  cFiles: number;
  flags: number;
  setID: number;
  iCabinet: number;
  cbCFHeader?: number;
  cbCFFolder?: number;
  cbCFData?: number;
  abReserve?: Uint8Array;
  szCabinetPrev?: string;
  szDiskPrev?: string;
  szCabinetNext?: string;
  szDiskNext?: string;
};

type CabFolder = {
  coffCabStart: number;
  cCFData: number;
  typeCompress: number;
  abReserve?: Uint8Array;
};

type CabFile = {
  cbFile: number;
  uoffFolderStart: number;
  iFolder: number;
  date: number;
  time: number;
  attribs: number;
  szName: string;
};

export type ExtractedFile = {
  name: string;
  data: Uint8Array;
};

export function isOnepkg(data: Uint8Array): boolean {
  return data.length >= 8 && new DataView(data.buffer, data.byteOffset, 4).getUint32(0, true) === CAB_SIGNATURE;
}

/**
 * Extracts all files contained in a CAB archive (e.g. a .onepkg file).
 */
/** Extracts all files from a OneNote package (.onepkg). */
export async function extractOnepkg(
  data: Uint8Array
): Promise<ExtractedFile[]> {
  return extractCab(data);
}

async function extractCab(data: Uint8Array): Promise<ExtractedFile[]> {
  const header = parseHeader(data);
  const folders = parseFolders(data, header);
  const files = parseFiles(data, header);

  // Decompress each folder and slice out the contained files.
  const decompressed = await Promise.all(
    folders.map((folder) => decompressFolder(data, folder, header))
  );

  const result: ExtractedFile[] = [];
  for (const file of files) {
    const folderData = decompressed[file.iFolder];
    if (!folderData) continue;
    result.push({
      name: file.szName,
      data: folderData.slice(
        file.uoffFolderStart,
        file.uoffFolderStart + file.cbFile
      )
    });
  }
  return result;
}

function parseHeader(data: Uint8Array): CabHeader {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (view.getUint32(0, true) !== CAB_SIGNATURE)
    throw new Error(`Invalid cabinet signature.`);
  const header: CabHeader = {
    headerEnd: 36,
    cbCabinet: view.getUint32(8, true),
    coffFiles: view.getUint32(16, true),
    versionMinor: view.getUint8(24),
    versionMajor: view.getUint8(25),
    cFolders: view.getUint16(26, true),
    cFiles: view.getUint16(28, true),
    flags: view.getUint16(30, true),
    setID: view.getUint16(32, true),
    iCabinet: view.getUint16(34, true)
  };
  let offset = 36;
  if (header.flags & 0x4) {
    header.cbCFHeader = view.getUint16(offset, true);
    offset += 2;
    header.cbCFFolder = view.getUint8(offset);
    offset += 1;
    header.cbCFData = view.getUint8(offset);
    offset += 1;
    header.abReserve = data.slice(offset, offset + header.cbCFHeader);
    offset += header.cbCFHeader;
  }
  header.headerEnd = offset;
  return header;
}

function parseFolders(data: Uint8Array, header: CabHeader): CabFolder[] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const folders: CabFolder[] = [];
  let offset = header.headerEnd;
  for (let i = 0; i < header.cFolders; ++i) {
    const folder: CabFolder = {
      coffCabStart: view.getUint32(offset, true),
      cCFData: view.getUint16(offset + 4, true),
      typeCompress: view.getUint16(offset + 6, true)
    };
    offset += 8;
    if (header.flags & 0x4) {
      folder.abReserve = data.slice(offset, offset + (header.cbCFFolder ?? 0));
      offset += header.cbCFFolder ?? 0;
    }
    folders.push(folder);
  }
  return folders;
}

function parseFiles(data: Uint8Array, header: CabHeader): CabFile[] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const files: CabFile[] = [];
  let offset =
    header.headerEnd +
    header.cFolders * 8 +
    (header.flags & 0x4 ? header.cFolders * (header.cbCFFolder ?? 0) : 0);

  for (let i = 0; i < header.cFiles; ++i) {
    const cbFile = view.getUint32(offset, true);
    const uoffFolderStart = view.getUint32(offset + 4, true);
    const iFolder = view.getUint16(offset + 8, true);
    const date = view.getUint16(offset + 10, true);
    const time = view.getUint16(offset + 12, true);
    const attribs = view.getUint16(offset + 14, true);
    offset += 16;

    let nameEnd = data.indexOf(0, offset);
    if (nameEnd === -1) nameEnd = data.length;
    const szName = new TextDecoder("utf-8").decode(
      data.slice(offset, nameEnd)
    );
    offset = nameEnd + 1;

    files.push({ cbFile, uoffFolderStart, iFolder, date, time, attribs, szName });
  }
  return files;
}

type CfData = {
  cbData: number;
  cbUncomp: number;
  abReserve?: Uint8Array;
  compData: Uint8Array;
};

function parseCfDataBlocks(
  data: Uint8Array,
  folder: CabFolder,
  header: CabHeader
): CfData[] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const blocks: CfData[] = [];
  let offset = folder.coffCabStart;
  for (let i = 0; i < folder.cCFData; ++i) {
    const csum = view.getUint32(offset, true);
    const cbData = view.getUint16(offset + 4, true);
    const cbUncomp = view.getUint16(offset + 6, true);
    offset += 8;
    let abReserve: Uint8Array | undefined;
    if (header.flags & 0x4) {
      abReserve = data.slice(offset, offset + (header.cbCFData ?? 0));
      offset += header.cbCFData ?? 0;
    }
    const compData = data.slice(offset, offset + cbData);
    offset += cbData;
    blocks.push({ cbData, cbUncomp, abReserve, compData });
    void csum;
  }
  return blocks;
}

async function decompressFolder(
  data: Uint8Array,
  folder: CabFolder,
  header: CabHeader
): Promise<Uint8Array> {
  const blocks = parseCfDataBlocks(data, folder, header);
  const compressType = folder.typeCompress & 0x00ff;
  const output: Uint8Array[] = [];

  if (compressType === 0x0) {
    // NONE
    for (const block of blocks) output.push(block.compData);
  } else if (compressType === 0x1) {
    // MSZIP
    for (const block of blocks) {
      if (block.cbData === 0) continue;
      const sig = block.compData[0] | (block.compData[1] << 8);
      if (sig !== 0x4b43) throw new Error(`MSZIP signature error: ${sig}`);
      const inflated = await new Promise<Uint8Array>((resolve, reject) => {
        inflate(block.compData.slice(2), (err, result) => {
          if (err) return reject(err);
          resolve(result);
        });
      });
      output.push(inflated);
    }
  } else if (compressType === 0x3) {
    // LZX / LZXD
    const windowSize = (folder.typeCompress & 0x1f00) >> 8;
    const lzxd = await Lzxd.create(toWindowSize(windowSize));
    try {
      for (const block of blocks) {
        if (block.cbData === 0) continue;
        const decompressed = lzxd.decompressNext(block.compData);
        if (decompressed) output.push(decompressed);
      }
    } finally {
      lzxd.free();
    }
  } else {
    throw new Error(`Not supported compression type = ${folder.typeCompress}`);
  }

  const totalLength = output.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of output) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function toWindowSize(num: number): number {
  switch (num) {
    case 15: return 32768;
    case 16: return 65536;
    case 17: return 131072;
    case 18: return 262144;
    case 19: return 524288;
    case 20: return 1048576;
    case 21: return 2097152;
    case 22: return 4194304;
    case 23: return 8388608;
    case 24: return 16777216;
    case 25: return 33554432;
    default:
      throw new Error(`Invalid window size: ${num}`);
  }
}
