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
import {
  CBFormat,
  FileChunkReference,
  STPFormat,
} from "../../utils/file-chunk-reference";
import { ExtendedGUID } from "../../utils/guid";
import { FileNode } from "../file-node";

/**
 * The data for a {@link FileNode} structure (section 2.4.3) that specifies an object (section 2.1.5) that has been revised. The value of the FileNode.FileNodeID field MUST be 0x042. The revised object is identified by the oid field, and the revised data is at the location specified by the ref field.
 */
export type ObjectRevisionWithRefCount2FNDX = {
  /**
   *A {@link FileNodeChunkReference} structure (section 2.2.4.2) that specifies a reference to an {@link ObjectSpaceObjectPropSet} structure (section 2.6.1) containing the revised data for the object referenced by the oid field.
   */
  ref: FileChunkReference<unknown, unknown>;

  /**
   * A {@link CompactID} structure (section 2.2.2) that specifies the object that has been revised.
   */
  oid: CompactID;

  /**
   * A bit that specifies whether the {@link ObjectSpaceObjectPropSet} structure referenced by the ref field contains references to other objects.
   */
  fHasOidReferences: boolean;

  /**
   * A bit that specifies whether the {@link ObjectSpaceObjectPropSet} structure referenced by the ref field contains references to object spaces (section 2.1.4).
   */
  fHasOsidReferences: boolean;

  /**
   * An unsigned integer that specifies the reference count for this object.
   */
  cRef: number;
};

export function ObjectRevisionWithRefCount2FNDX(
  reader: OneNoteReader,
  header: FileNode
): ObjectRevisionWithRefCount2FNDX {
  const ref = reader.readFileChunkReference(header.stpFormat, header.cbFormat);
  const oid = reader.deserializeCompactId();
  const data = reader.deserializeByte();

  return {
    ref,
    oid,
    fHasOidReferences: (data & 0x1) !== 0,
    fHasOsidReferences: (data & 0x2) !== 0,
    cRef: reader.deserializeInt(),
  };
}
