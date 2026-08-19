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
import { ExtendedGUID } from "../../utils/guid";

/**
 * The data for a {@link FileNode} structure (section 2.4.3) that specifies the beginning of an object space manifest list (section 2.1.6).
 */
export type ObjectSpaceManifestListStartFND = {
  /**
   * An {@link ExtendedGUID} structure that specifies the identity of the object space (section 2.1.4) being specified by this object space manifest list. MUST match the ObjectSpaceManifestListReferenceFND.gosid field (section 2.5.2) of the {@link FileNode} structure that referenced this file node list (section 2.4).
   */
  gosid: ExtendedGUID;
};

export function ObjectSpaceManifestListStartFND(
  reader: OneNoteReader
): ObjectSpaceManifestListStartFND {
  return {
    gosid: reader.deserializeExtendedGUID(),
  };
}
