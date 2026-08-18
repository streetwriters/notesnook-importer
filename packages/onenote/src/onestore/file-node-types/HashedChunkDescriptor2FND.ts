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

import { OneNoteReader } from "../../reader";
import { toHex } from "../../utils/reader";
import { FileChunkReference } from "../../utils/file-chunk-reference";
import { FileNode } from "../file-node";

/**
 * The data for a FileNode structure (section 2.4.3) that specifies a reference to an ObjectSpaceObjectPropSet structure (section 2.6.1).
 */
export type HashedChunkDescriptor2FND = {
  /**
   * A FileNodeChunkReference structure (section 2.2.4.2) that specifies the location and size of an ObjectSpaceObjectPropSet structure.
   */
  BlobRef: FileChunkReference<unknown, unknown>;
  /**
   *  An unsigned integer that specifies an MD5 checksum, as specified in [RFC1321], of data referenced by the BlobRef field.
   */
  guidHash: string;
};

export function HashedChunkDescriptor2FND(
  reader: OneNoteReader,
  header: FileNode
): HashedChunkDescriptor2FND {
  return {
    BlobRef: reader.readFileChunkReference(header.stpFormat, header.cbFormat),
    guidHash: toHex(reader.deserializeBytes(16)),
  };
}
