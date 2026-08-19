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

import { CompactID, OneNoteReader } from "../../reader";
import { FileChunkReference } from "../../utils/file-chunk-reference";
import { FileNode } from "../file-node";

/**
 * The data for a {@link FileNode} structure (section 2.4.3) that specifies updated reference counts for objects (section 2.1.5). The override data is specified by the ref field if the value of the ref field is not "fcrNil" (section 2.2.4); otherwise, the override data is specified by the data field. The total size of the data field, in bytes, MUST be less than 1024; otherwise, the override data MUST be in the location referenced by the ref field.
 */
export type ObjectInfoDependencyOverridesFND = {
  /**
   *A {@link FileNodeChunkReference} structure that specifies the location of an {@link ObjectInfoDependencyOverrideData} structure (section 2.6.10) if the value of the ref field is not "fcrNil".
   */
  ref: FileChunkReference<unknown, unknown>;

  /**
   * An optional ObjectInfoDependencyOverrideData structure (section 2.6.10) that specifies the updated reference counts for objects (section 2.1.5). MUST exist if the value of the ref field is "fcrNil".
   */
  data?: ObjectInfoDependencyOverrideData;
};

export function ObjectInfoDependencyOverridesFND(
  reader: OneNoteReader,
  header: FileNode
): ObjectInfoDependencyOverridesFND {
  const ref = reader.readFileChunkReference(header.stpFormat, header.cbFormat);
  return {
    ref,
    data: ObjectInfoDependencyOverrideData(reader, ref.isNil ? undefined : ref),
  };
}

/**
 * The {@link ObjectInfoDependencyOverrideData} structure specifies updated reference counts for objects (section 2.1.5).
 */
type ObjectInfoDependencyOverrideData = {
  /**
   * An unsigned integer that specifies the number of elements in Overrides1.
   */
  c8BitOverrides: number;
  /**
   * An unsigned integer that specifies the number of elements in Overrides2.
   */
  c32BitOverrides: number;

  /**
   * An unsigned integer that specifies a CRC (section 2.1.2) of the reference counts. The crc field is computed as follows:
   * 1. crc is initialized to zero.
   * 2. If this FileNode structure (section 2.4.3) follows an object group (section 2.1.13) in the revision manifest, the crc field is calculated cumulatively on every reference count of every object declared in the group in the order they appear in the group. The following reference counts are used:
   * - The ObjectDeclarationFileData3RefCountFND.cRef field, extended to an unsigned integer of size 4 bytes.
   * - The ObjectDeclarationFileData3LargeRefCountFND.cRef field.
   * - The ObjectDeclaration2RefCountFND.cRef field, extended to an unsigned integer of size 4 bytes.
   * - The ObjectDeclaration2LargeRefCountFND.cRef field.
   * - The ReadOnlyObjectDeclaration2RefCountFND.cRef field, extended to an unsigned integer of size 4 bytes.
   * - The ReadOnlyObjectDeclaration2LargeRefCountFND.cRef field.
   *
   * 3. The crc field is calculated cumulatively on each element in the Overrides1 field, where each element is treated as an array of 5 bytes.
   * 4. The crc field is calculated cumulatively on each element in the Overrides2 field, where each element is treated as an array of 8 bytes.
   */
  crc: number;

  /**
   * An array of ObjectInfoDependencyOverride8 structures (section 2.6.11) that specifies the updated reference counts for objects (section 2.1.5) if the updated reference count is less than or equal to 255.
   */
  Overrides1: ObjectInfoDependencyOverride8[];

  /**
   * An array of ObjectInfoDependencyOverride32 structures (section 2.6.12) that specifies the updated reference counts for objects if the updated reference count is greater than 255.
   */
  Overrides2: ObjectInfoDependencyOverride32[];
};

function ObjectInfoDependencyOverrideData(
  reader: OneNoteReader,
  ref?: FileChunkReference<unknown, unknown>
) {
  const currentOffset = reader.position;
  if (ref && !reader.trySeek(ref.stp)) {
    return {
      c8BitOverrides: 0,
      c32BitOverrides: 0,
      crc: 0,
      Overrides1: [],
      Overrides2: [],
    };
  }

  const result: ObjectInfoDependencyOverrideData = {
    c8BitOverrides: reader.deserializeInt(),
    c32BitOverrides: reader.deserializeInt(),
    crc: reader.deserializeInt(),
    Overrides1: [],
    Overrides2: [],
  };
  for (let i = 0; i < result.c8BitOverrides; ++i)
    result.Overrides1.push(ObjectInfoDependencyOverride8(reader));
  for (let i = 0; i < result.c32BitOverrides; ++i)
    result.Overrides2.push(ObjectInfoDependencyOverride32(reader));

  if (ref) reader.seek(currentOffset);
  return result;
}

/**
 * The {@link ObjectInfoDependencyOverride8} structure specifies the updated reference count for an object (section 2.1.5).
 */
type ObjectInfoDependencyOverride8 = {
  /**
   * A {@link CompactID} structure (section 2.2.2) that specifies the identity of the object with the updated reference count. The object MUST already be defined in the current revision (section 2.1.8).
   */
  oid: CompactID;

  /**
   * An unsigned integer that specifies the updated reference count for the oid field.
   */
  cRef: number;
};
function ObjectInfoDependencyOverride8(reader: OneNoteReader) {
  return { oid: reader.deserializeCompactId(), cRef: reader.deserializeByte() };
}

/**
 * The {@link ObjectInfoDependencyOverride32} structure specifies the updated reference count for an object (section 2.1.5).
 */
type ObjectInfoDependencyOverride32 = {
  /**
   * A {@link CompactID} structure (section 2.2.2) that specifies the identity of the object with the updated reference count. The object MUST already be defined in the current revision (section 2.1.8).
   */
  oid: CompactID;

  /**
   * An unsigned integer that specifies the updated reference count for the oid field.
   */
  cRef: number;
};
function ObjectInfoDependencyOverride32(reader: OneNoteReader) {
  return { oid: reader.deserializeCompactId(), cRef: reader.deserializeInt() };
}
