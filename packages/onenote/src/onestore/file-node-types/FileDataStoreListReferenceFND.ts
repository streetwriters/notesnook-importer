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
import { FileNode } from "../file-node";

/**
 * The data for a {@link FileNode} structure (section 2.4.3) that specifies a file node list (section 2.4) containing references to file data objects. The referenced file node list MUST contain only FileNode structures with a FileNodeID field value equal to 00x094 (FileDataStoreObjectReferenceFND structure). The value of the FileNode.FileNodeID field MUST be 0x090.
 */
export type FileDataStoreListReferenceFND = {
  /**
   * A {@link FileNodeChunkReference} structure (section 2.2.4.2) that specifies a reference to a {@link FileNodeListFragment} structure (section 2.4.1).
   */
  ref: FileChunkReference<unknown, unknown>;
};

export function FileDataStoreListReferenceFND(
  reader: OneNoteReader,
  header: FileNode
): FileDataStoreListReferenceFND {
  return {
    ref: reader.readFileChunkReference(header.stpFormat, header.cbFormat),
  };
}
