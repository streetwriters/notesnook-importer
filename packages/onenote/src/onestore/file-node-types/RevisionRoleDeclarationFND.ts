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
import { RevisionManifestStart6FND } from "./RevisionManifestStart6FND";

/**
 * The data for a {@link FileNode} structure (section 2.4.3) that specifies a new additional revision role (section 2.1.12) value to associate with a revision (section 2.1.8). The revision role label is in the default context (section 2.1.11).
 */
export type RevisionRoleDeclarationFND = {
  /**
   * An {@link ExtendedGUID} structure (section 2.2.1) that specifies the identity of the revision to add the revision role to. MUST match the value of the RevisionManifestStart4FND.rid field, RevisionManifestStart6FND.rid field or RevisionManifestStart7FND.base.rid field of one of preceding revision manifests (section 2.1.9) in the current revision manifest list (section 2.1.10).
   */
  rid: ExtendedGUID;
  /**
   * Specifies a revision role for the default context.
   */
  RevisionRole: number;
};

export function RevisionRoleDeclarationFND(
  reader: OneNoteReader
): RevisionRoleDeclarationFND {
  return {
    rid: reader.deserializeExtendedGUID(),
    RevisionRole: reader.deserializeInt(),
  };
}
