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
 * The data for a {@link FileNode} structure (section 2.4.3) that specifies the beginning of a revision manifest list (section 2.1.10).
 */
export type RevisionManifestListStartFND = {
  /**
   * An {@link ExtendedGUID} structure (section 2.2.1) that specifies the identity of the object space (section 2.1.4) being revised by the revisions (section 2.1.8) in this list.
   */
  gosid: ExtendedGUID;

  /**
   * MUST be ignored.
   */
  nInstance?: Uint8Array;
};

export function RevisionManifestListStartFND(
  reader: OneNoteReader
): RevisionManifestListStartFND {
  const gosid = reader.deserializeExtendedGUID();
  const nInstance = reader.deserializeBytes(4);
  return {
    gosid,
  };
}
