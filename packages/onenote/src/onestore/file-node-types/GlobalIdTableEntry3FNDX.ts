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
import { FileNode } from "../file-node";

/**
 * The data for a {@link FileNode} structure (section 2.4.3) that specifies a range of entries in the current global identification table (section 2.1.3) by referring to a range of entries in the global identification table of the dependency revision (section 2.1.8) of the revision manifest (section 2.1.9) that contains this global identification table. The value of the FileNode.FileNodeID field MUST be 0x026.
 */
export type GlobalIdTableEntry3FNDX = {
  /**
   *An unsigned integer that specifies the index of the first entry in the range of entries in global identification table of the dependency revision (section 2.1.8). The index MUST be present in the global identification table of the dependency revision.
   */
  iIndexCopyFromStart: number;

  /**
   * An unsigned integer that specifies the number of entries in the range. All indices from the value of the iIndexCopyFromStart field to the value of (iIndexCopyFromStart + cEntriesToCopy – 1) inclusive MUST be present in the global identification table of the dependency revision.
   */
  cEntriesToCopy: number;

  /**
   * An unsigned integer that specifies the index of the first entry in the range in the current global identification table. Other entries assume the consecutive indices.
   *
   * All indices from the value of iIndexCopyToStart to the value of (iIndexCopyToStart + cEntriesToCopy – 1) inclusive MUST be less than 0xFFFFFF and MUST be unique relative to the other indices in this global identification table specified by FileNode structures with the values of the FileNode.FileNodeID field equal to 0x024 (GlobalIdTableEntryFNDX structure), 0x025 (GlobalIdTableEntry2FNDX structure), and 0x026 (GlobalIdTableEntry3FNDX structure).
   */
  iIndexCopyToStart: number;
};

export function GlobalIdTableEntry3FNDX(
  reader: OneNoteReader
): GlobalIdTableEntry3FNDX {
  return {
    iIndexCopyFromStart: reader.deserializeInt(),
    cEntriesToCopy: reader.deserializeInt(),
    iIndexCopyToStart: reader.deserializeInt(),
  };
}
