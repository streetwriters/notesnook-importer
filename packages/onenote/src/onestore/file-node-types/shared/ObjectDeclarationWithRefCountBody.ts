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

import { CompactID, OneNoteReader } from "../../../reader";

/**
 * The {@link ObjectDeclarationWithRefCountBody} structure specifies the identity of an object (section 2.1.5) and the type of data the object contains.
 */
export type ObjectDeclarationWithRefCountBody = {
  /**
   * A {@link CompactID} structure (section 2.2.2) that specifies the identity of this object
   */
  oid: CompactID;
  /**
   * An unsigned integer that specifies the value of the JCID.index field of the object. MUST be 0x01.
   */
  jci: number;
  /**
   * An unsigned integer that specifies whether the data contained by this object is encrypted. MUST be zero.
   */
  odcs: number;
  /**
   * An unsigned integer that MUST be zero, and MUST be ignored.
   */
  fReserved1: number;
  /**
   * Specifies whether this object contains references to other objects.
   */
  fHasOidReferences: boolean;
  /**
   * Specifies whether this object contains references to object spaces (section 2.1.4). MUST be zero.
   */
  fHasOsidReferences: boolean;
  /**
   * An unsigned integer that MUST be zero, and MUST be ignored.
   */
  fReserved2: number;
};

export function ObjectDeclarationWithRefCountBody(
  reader: OneNoteReader
): ObjectDeclarationWithRefCountBody {
  const oid = reader.deserializeCompactId();
  const data = reader.deserializeInt();
  // The next two bytes are reserved.
  reader.deserializeBytes(2);

  return {
    oid,
    jci: data & 0x3ff,
    odcs: (data >> 10) & 0xf,
    fReserved1: (data >> 14) & 0x3,
    fHasOidReferences: ((data >> 16) & 0x1) !== 0,
    fHasOsidReferences: ((data >> 17) & 0x1) !== 0,
    fReserved2: data >> 18,
  };
}
