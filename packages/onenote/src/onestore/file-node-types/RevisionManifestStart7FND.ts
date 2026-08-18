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
 * The data for a {@link FileNode} structure (section 2.4.3) that specifies the beginning of a revision manifest (section 2.1.9) for a context (section 2.1.11) of an object space (section 2.1.4).
 */
export type RevisionManifestStart7FND = {
  /**
   * A {@link RevisionManifestStart6FND} structure (section 2.5.7) that specifies the identity and other attributes of this revision (section 2.1.8).
   */
  base: RevisionManifestStart6FND;
  /**
   * An {@link ExtendedGUID} structure (section 2.2.1) that specifies the context that labels this revision (section 2.1.8).
   */
  gctxid: ExtendedGUID;
};

export function RevisionManifestStart7FND(
  reader: OneNoteReader
): RevisionManifestStart7FND {
  return {
    base: RevisionManifestStart6FND(reader),
    gctxid: reader.deserializeExtendedGUID(),
  };
}
