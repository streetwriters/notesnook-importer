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
export type ObjectSpaceManifestListReferenceFND = {
  /**
   * An {@link ExtendedGUID} structure (section 2.2.1) that specifies the identity of the object space (section 2.1.4) specified by the object space manifest list. MUST NOT be {{00000000-0000-0000-0000-000000000000},0} and MUST be unique relative to the other ObjectSpaceManifestListReferenceFND.gosid fields in this file.
   */
  gosid: ExtendedGUID;
  /**
   * A {@link FileNodeChunkReference} structure (section 2.2.4.2) that specifies the location and size of the first FileNodeListFragment structure (section 2.4.1) in the object space manifest list.
   */
  ref: FileChunkReference<unknown, unknown>;
};

export function ObjectSpaceManifestListReferenceFND(
  reader: OneNoteReader,
  header: FileNode
): ObjectSpaceManifestListReferenceFND {
  return {
    ref: reader.readFileChunkReference(header.stpFormat, header.cbFormat),
    gosid: reader.deserializeExtendedGUID(),
  };
}
