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
import { GUID } from "../../utils/guid";
import { FileNode } from "../file-node";

/**
 * The data for a {@link FileNode} structure (section 2.4.3) that specifies a reference to a file data object. All such FileNode structures MUST be contained in the file node list (section 2.4) specified by a {@link FileDataStoreListReferenceFND} structure (section 2.5.21).
 */
export type FileDataStoreObjectReferenceFND = {
  /**
   * A {@link FileNodeChunkReference} structure (section 2.2.4.2) that specifies a reference to a {@link FileDataStoreObject} structure (section 2.6.13).
   */
  ref: FileChunkReference<unknown, unknown>;

  /**
   * A GUID, as specified by [MS-DTYP], that specifies the identity of this file data object. MUST be unique with respect to all FileDataStoreObjectReferenceFND structures.
   */
  guidReference: GUID;
};

export function FileDataStoreObjectReferenceFND(
  reader: OneNoteReader,
  header: FileNode
): FileDataStoreObjectReferenceFND {
  return {
    ref: reader.readFileChunkReference(header.stpFormat, header.cbFormat),
    guidReference: reader.deserializeGUID(),
  };
}
