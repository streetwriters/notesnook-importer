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
import { GUID } from "../../utils/guid";

/**
 * The data for a {@link FileNode} structure (section 2.4.3) that specifies the root object (section 2.1.7) of a revision (section 2.1.8) for a particular root role. The value of the FileNode.FileNodeID field MUST be 0x059.
 */
export type RootObjectReference2FNDX = {
  /**
   * A {@link CompactID} structure (section 2.2.2) that specifies the identity of the root object of the containing revision for the role specified by the RootRole field.
   */
  oidRoot: CompactID;
  /**
   * An unsigned integer that specifies the role of the root object.
   */
  RootRole: number;
};

export function RootObjectReference2FNDX(
  reader: OneNoteReader
): RootObjectReference2FNDX {
  return {
    oidRoot: reader.deserializeCompactId(),
    RootRole: reader.deserializeInt(),
  };
}
