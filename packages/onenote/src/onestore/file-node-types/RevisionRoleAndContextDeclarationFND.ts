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
import { RevisionRoleDeclarationFND } from "./RevisionRoleDeclarationFND";

/**
 * The data for a {@link FileNode} structure (section 2.4.3) that specifies a new additional revision role (section 2.1.12) and context (section 2.1.11) pair to associate with a revision (section 2.1.8).
 */
export type RevisionRoleAndContextDeclarationFND = {
  /**
   * A {@link RevisionRoleDeclarationFND} structure (section 2.5.17) that specifies the revision and revision role.
   */
  base: RevisionRoleDeclarationFND;
  /**
   * An {@link ExtendedGUID} structure (section 2.2.1) that specifies the context.
   */
  gctxid: ExtendedGUID;
};

export function RevisionRoleAndContextDeclarationFND(
  reader: OneNoteReader
): RevisionRoleAndContextDeclarationFND {
  return {
    base: RevisionRoleDeclarationFND(reader),
    gctxid: reader.deserializeExtendedGUID(),
  };
}
