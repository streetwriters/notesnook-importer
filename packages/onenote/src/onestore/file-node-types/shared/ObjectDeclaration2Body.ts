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

import { CompactID, JCID, OneNoteReader } from "../../../reader";

/**
 * The {@link ObjectDeclaration2Body} structure specifies the identity of an object (section 2.1.5) and the type of data the object contains.
 */
export type ObjectDeclaration2Body = {
  /**
   * A {@link CompactID} (section 2.2.2) that specifies the identity of this object.
   */
  oid: CompactID;
  /**
   * A {@link JCID} (section 2.6.14) that specifies the type of data this object contains.
   */
  jcid: JCID;
  /**
   * A bit that specifies whether this object contains references to other objects.
   */
  fHasOidReferences: boolean;
  /**
   * A bit that specifies whether this object contains references to object spaces (section 2.1.4) or contexts (section 2.1.11).
   */
  fHasOsidReferences: boolean;
};

export function ObjectDeclaration2Body(
  reader: OneNoteReader
): ObjectDeclaration2Body {
  const oid = reader.deserializeCompactId();
  const jcid = reader.deserializeJCID();
  const data = reader.deserializeByte();
  return {
    oid,
    jcid,
    fHasOidReferences: (data & 0x1) !== 0,
    fHasOsidReferences: (data & 0x2) !== 0,
  };
}
