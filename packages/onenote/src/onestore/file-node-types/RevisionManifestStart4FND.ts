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

export enum RevisionRole {
  DefaultContent = 1,
  Metadata,
  EncryptionKey,
  VersionMetadata,
}

/**
 * The data for a {@link FileNode} structure (section 2.4.3) that specifies the beginning of a revision manifest (section 2.1.9). This revision manifest applies to the default context (section 2.1.11) of the containing object space (section 2.1.4).
 */
export type RevisionManifestStart4FND = {
  /**
   * An {@link ExtendedGUID} structure (section 2.2.1) that specifies the identity of this revisio-n (section 2.1.8). MUST NOT be "{{00000000-0000-0000-0000-000000000000}, 0}" and MUST be unique among RevisionManifestStart4FND.rid fields within the containing revision manifest list (section 2.1.10).
   */
  rid: ExtendedGUID;
  /**
   * An {@link ExtendedGUID} structure that specifies the identity of a dependency revision.
   *
   * If the value is "{{00000000-0000-0000-0000-000000000000}, 0}", then this revision manifest has no dependency revision. Otherwise, this value MUST be equal to the RevisionManifestStart4FND.rid field of a previous revision manifest within this (section 2.1.9) revision manifest list.
   */
  ridDependent: ExtendedGUID;
  /**
   * Undefined and MUST be ignored.
   */
  timeCreation?: Uint8Array;
  /**
   * An integer that specifies the revision role (section 2.1.12) that labels this revision (section 2.1.8).
   */
  revisionRole: RevisionRole;
  /**
   * An unsigned integer that specifies whether the data contained by this revision manifest is encrypted. MUST be 0 and MUST be ignored.
   */
  odcsDefault?: number;
};

export function RevisionManifestStart4FND(
  reader: OneNoteReader
): RevisionManifestStart4FND {
  const rid = reader.deserializeExtendedGUID();
  const ridDependent = reader.deserializeExtendedGUID();
  const timeCreation = reader.deserializeBytes(8);
  const revisionRole = reader.deserializeInt();
  const odcsDefault = reader.deserializeShort();
  return { rid, ridDependent, revisionRole };
}
