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
 * The data for a {@link FileNode} structure (section 2.4.3) that specifies a signature for data of objects declared by FileNode structures that follow this FileNode structure. The signature’s effect terminates when a {@link FileNode} structure with FileNodeID field values equal to one of the following is encountered:
 *
 * 1. 0x0B8 (ObjectGroupEndFND structure, section 2.4.3)
 * 2. 0x08C (DataSignatureGroupDefinitionFND structure, section 2.5.33)
 * 3. 0x01C (RevisionManifestEndFND structure, section 2.4.3
 */
export type DataSignatureGroupDefinitionFND = {
  /**
   * An {@link ExtendedGUID} structure (section 2.2.1) that specifies the signature. All declarations of an object (section 2.1.5) with the same identity and the same DataSignatureGroup field not equal to {{00000000-0000-0000-0000-000000000000}, 0} MUST have the same data.
   */
  DataSignatureGroup: ExtendedGUID;
};

export function DataSignatureGroupDefinitionFND(
  reader: OneNoteReader
): DataSignatureGroupDefinitionFND {
  return {
    DataSignatureGroup: reader.deserializeExtendedGUID(),
  };
}
