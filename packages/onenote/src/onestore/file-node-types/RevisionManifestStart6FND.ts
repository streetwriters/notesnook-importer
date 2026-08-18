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
 * The data for a {@link FileNode} structure (section 2.4.3) that specifies the beginning of a revision manifest (section 2.1.9) for the default context (section 2.1.11) of an object space (section 2.1.4).
 */
export type RevisionManifestStart6FND = {
  /**
   * An {@link ExtendedGUID} structure (section 2.2.1) that specifies the identity of this revision (section 2.1.8). MUST NOT be "{{00000000-0000-0000-0000-000000000000}, 0}" and MUST be unique among RevisionManifestStart6FND.rid and RevisionManifestStart7FND.base.rid fields within the containing revision manifest list (section 2.1.10).
   */
  rid: ExtendedGUID;
  /**
   * An {@link ExtendedGUID} structure that specifies the identity of a dependency revision.
   *
   * If the value is "{{00000000-0000-0000-0000-000000000000}, 0}", then this revision manifest has no dependency revision. Otherwise, this value MUST be equal to the RevisionManifestStart6FND.rid field or the RevisionManifestStart7FND.base.rid field of a previous revision manifest within this revision manifest list.
   */
  ridDependent: ExtendedGUID;
  /**
   * An integer that specifies the revision role (section 2.1.12) that labels this revision (section 2.1.8).
   */
  revisionRole: number;
  /**
   * An unsigned integer that specifies whether the data contained by this revision manifest is encrypted. MUST be one of the values described in the following:
   *
   * 1. 0x0000 = No encryption
   * 2. 0x0002 = Encrypted. Property sets within this revision manifest MUST be ignored and MUST NOT be altered.
   *
   * MUST specify the same type of data encoding as used in the dependency revision (section 2.1.8), if one was specified in the ridDependent field.
   */
  odcsDefault: number;
};

export function RevisionManifestStart6FND(
  reader: OneNoteReader
): RevisionManifestStart6FND {
  const rid = reader.deserializeExtendedGUID();
  const ridDependent = reader.deserializeExtendedGUID();
  const revisionRole = reader.deserializeInt();
  const odcsDefault = reader.deserializeShort();
  return { rid, ridDependent, revisionRole, odcsDefault };
}
