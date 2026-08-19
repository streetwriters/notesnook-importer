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
import {
  CBFormat,
  FileChunkReference,
  STPFormat,
} from "../../utils/file-chunk-reference";
import { ExtendedGUID } from "../../utils/guid";
import { FileNode } from "../file-node";

/**
 * The data for a {@link FileNode} structure (section 2.4.3) that specifies the reference to an object space manifest list (section 2.1.6).
 */
export type RevisionManifestListReferenceFND = {
  /**
   * A {@link FileNodeChunkReference} structure (section 2.2.4.2) that specifies the location and size of the first FileNodeListFragment structure (section 2.4.1) in the revision manifest list.
   */
  ref: FileChunkReference<unknown, unknown>;
};

export function RevisionManifestListReferenceFND(
  reader: OneNoteReader,
  header: FileNode
): RevisionManifestListReferenceFND {
  return {
    ref: reader.readFileChunkReference(header.stpFormat, header.cbFormat),
  };
}
