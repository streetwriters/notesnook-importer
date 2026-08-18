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
import { FileChunkReference } from "../../utils/file-chunk-reference";
import { ExtendedGUID } from "../../utils/guid";
import { FileNode } from "../file-node";

/**
 * The data for a {@link FileNode} structure (section 2.4.3) that specifies a reference to an object group (section 2.1.13). The value of the FileNode.FileNodeID field MUST be set to 0x0B0.
 */
export type ObjectGroupListReferenceFND = {
  /**
   * A {@link FileNodeChunkReference} structure (section 2.2.4.2) that specifies the location and size of the first FileNodeListFragment structure (section 2.4.1) in the file node list (section 2.4) of the object group.
   */
  ref: FileChunkReference<unknown, unknown>;

  /**
   * An {@link ExtendedGUID} structure (section 2.2.1) that specifies the identity of the object group that the ref field value points to. MUST be the same value as the ObjectGroupStartFND.oid field value of the object group that the ref field points to.
   */
  ObjectGroupID: ExtendedGUID;
};

export function ObjectGroupListReferenceFND(
  reader: OneNoteReader,
  header: FileNode
): ObjectGroupListReferenceFND {
  return {
    ref: reader.readFileChunkReference(header.stpFormat, header.cbFormat),
    ObjectGroupID: reader.deserializeExtendedGUID(),
  };
}
