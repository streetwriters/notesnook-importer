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
import { GUID } from "../../utils/guid";

/**
 * The data for a {@link FileNode} structure (section 2.4.3) that specifies an entry in the current global identification table (section 2.1.3). The value of the FileNode.FileNodeID field MUST be 0x024.
 */
export type GlobalIdTableEntryFNDX = {
  /**
   * An unsigned integer that specifies the index of the entry. MUST be less than 0xFFFFFF. MUST be unique relative to the other indexes in this global identification table specified by FileNode structures with the values of the FileNode.FileNodeID fields equal to 0x024 (GlobalIdTableEntryFNDX structure), 0x25 (GlobalIdTableEntry2FNDX structure), and 0x26 (GlobalIdTableEntry3FNDX structure).
   */
  index: number;

  /**
   * A GUID, as specified by [MS-DTYP]. MUST NOT be {00000000-0000-0000-0000- 000000000000} and MUST be unique relative to the other GlobalIDTableEntryFNDX.guid fields in this global identification table (section 2.1.3).
   */
  guid: GUID;
};

export function GlobalIdTableEntryFNDX(
  reader: OneNoteReader
): GlobalIdTableEntryFNDX {
  return {
    index: reader.deserializeInt(),
    guid: reader.deserializeGUID(),
  };
}
