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
 * The data for a {@link FileNode} structure (section 2.4.3) that specifies the root object space (section 2.1.4) in a revision store file. There MUST be only one ObjectSpaceManifestRootFND structure (section 2.5.1) in the revision store file. This FileNode structure MUST be in the root file node list (section 2.1.14).
 */
export type ObjectSpaceManifestRootFND = {
  /**
   * An {@link ExtendedGUID} structure (section 2.2.1) that specifies the identity of the root object space. This value MUST be equal to the ObjectSpaceManifestListReferenceFND.gosid field (section 2.5.2) of an object space within the object space manifest list (section 2.1.6).
   */
  gosidRoot: ExtendedGUID;
};

export function ObjectSpaceManifestRootFND(
  reader: OneNoteReader
): ObjectSpaceManifestRootFND {
  return { gosidRoot: reader.deserializeExtendedGUID() };
}
