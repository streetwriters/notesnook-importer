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

// A minimal binary-plist writer, sufficient for building the NSKeyedArchiver
// CloudKit records used in the Apple Notes test fixtures.

const OBJECT_REF_SIZE = 4;

function writeInteger(value) {
  let size = 1;
  if (value > 0xffffffff) size = 8;
  else if (value > 0xffff) size = 4;
  else if (value > 0xff) size = 2;
  const payload = Buffer.alloc(size);
  payload.writeUIntBE(value, 0, size);
  return { marker: 0x10 | (size - 1), payload };
}

function refBytes(index) {
  const out = Buffer.alloc(OBJECT_REF_SIZE);
  out.writeUIntBE(index, 0, OBJECT_REF_SIZE);
  return out;
}

/**
 * Encodes a plain JS value graph into a binary plist. Supported values: null,
 * numbers (integers), strings, Uint8Array/Buffer, arrays and plain objects.
 * Objects that are structurally identical are shared (interned), which is how
 * binary plists avoid duplication.
 */
function encodeBplist(root) {
  const objects = [];

  const encodeNode = (marker, payload) => {
    const index = objects.length;
    objects.push(Buffer.concat([Buffer.from([marker]), payload]));
    return index;
  };

  const encodeLength = (length) => {
    const { marker, payload } = writeInteger(length);
    return Buffer.concat([Buffer.from([marker]), payload]);
  };

  const encodeValue = (value) => {
    if (value === null) return encodeNode(0x00, Buffer.alloc(0));
    if (typeof value === "number") {
      const { marker, payload } = writeInteger(value);
      return encodeNode(marker, payload);
    }
    if (typeof value === "string") {
      const data = Buffer.from(value, "utf8");
      if (data.length < 0xf) return encodeNode(0x50 | data.length, data);
      return encodeNode(0x5f, Buffer.concat([encodeLength(data.length), data]));
    }
    if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
      const data = Buffer.from(value);
      if (data.length < 0xf) return encodeNode(0x40 | data.length, data);
      return encodeNode(0x4f, Buffer.concat([encodeLength(data.length), data]));
    }
    if (Array.isArray(value)) {
      const refs = value.map((entry) => refBytes(encodeValue(entry)));
      const payload = Buffer.concat(refs);
      if (value.length < 0xf) return encodeNode(0xa0 | value.length, payload);
      return encodeNode(0xaf, Buffer.concat([encodeLength(value.length), payload]));
    }
    if (value && typeof value === "object") {
      const entries = Object.entries(value);
      const refs = Buffer.concat([
        ...entries.map(([key]) => refBytes(encodeValue(key))),
        ...entries.map(([, val]) => refBytes(encodeValue(val)))
      ]);
      if (entries.length < 0xf) return encodeNode(0xd0 | entries.length, refs);
      return encodeNode(0xdf, Buffer.concat([encodeLength(entries.length), refs]));
    }
    throw new Error(`Unsupported value: ${value}`);
  };

  const rootIndex = encodeValue(root);

  const objectTable = Buffer.concat(objects);
  const offsetIntSize = objectTable.length < 256 ? 1 : objectTable.length < 65536 ? 2 : 4;
  const offsetTableOffset = 8 + objectTable.length;

  let offset = 8;
  const offsetTable = Buffer.alloc(objects.length * offsetIntSize);
  for (let i = 0; i < objects.length; i++) {
    offsetTable.writeUIntBE(offset, i * offsetIntSize, offsetIntSize);
    offset += objects[i].length;
  }

  const trailer = Buffer.alloc(32);
  trailer.writeUInt8(offsetIntSize, 6);
  trailer.writeUInt8(OBJECT_REF_SIZE, 7);
  trailer.writeBigUInt64BE(BigInt(objects.length), 8);
  trailer.writeBigUInt64BE(BigInt(rootIndex), 16);
  trailer.writeBigUInt64BE(BigInt(offsetTableOffset), 24);

  return Buffer.concat([Buffer.from("bplist00"), objectTable, offsetTable, trailer]);
}

/**
 * Builds an NSKeyedArchiver plist from a plain value graph. Every object is
 * stored in the flat `$objects` table and referenced by its integer index,
 * which is the format Apple's `NSKeyedUnarchiver` actually reads.
 */
function buildKeyedArchive(root) {
  const objects = [null]; // $objects[0] is conventionally $null
  const interned = new Map();

  const intern = (value) => {
    if (value === null) return 0;
    if (typeof value === "number") {
      const idx = objects.length;
      objects.push(value);
      return idx;
    }
    if (typeof value === "string") {
      const idx = objects.length;
      objects.push(value);
      return idx;
    }
    if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
      const idx = objects.length;
      objects.push(Buffer.from(value));
      return idx;
    }
    if (Array.isArray(value)) {
      const idx = objects.length;
      objects.push(null); // placeholder
      objects[idx] = value.map(intern);
      return idx;
    }
    if (value && typeof value === "object") {
      const idx = objects.length;
      objects.push(null); // placeholder
      objects[idx] = Object.fromEntries(
        Object.entries(value).map(([key, val]) => [key, intern(val)])
      );
      return idx;
    }
    throw new Error(`Unsupported value: ${value}`);
  };

  const rootIndex = intern(root);
  return {
    $archiver: "NSKeyedArchiver",
    $version: 100000,
    $top: { root: rootIndex },
    $objects: objects
  };
}

module.exports = { encodeBplist, buildKeyedArchive };
