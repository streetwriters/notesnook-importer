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
import { ObjectSpaceObjectStreamHeader } from "./ObjectSpaceObjectStreamHeader";
import { ObjectSpaceObjectStreamOfOIDs } from "./ObjectSpaceObjectStreamOfOIDs";

/**
 * The {@link ObjectSpaceObjectStreamOfOSIDs} structure specifies the count and list of object spaces (section 2.1.4) referenced by an {@link ObjectSpaceObjectPropSet} structure (section 2.6.1).
 */
export type ObjectSpaceObjectStreamOfOSIDs = {
  /**
   * An {@link ObjectSpaceObjectStreamHeader} structure (section 2.6.5) that specifies the number of elements in the body field and whether the {@link ObjectSpaceObjectPropSet} structure contains ContextIDs field. The value of the header.OsidStreamNotPresent field MUST be "false". If the ContextIDs field is present, the value of the header.ExtendedStreamsPresent field MUST be true; otherwise, it MUST be false.
   */
  header: ObjectSpaceObjectStreamHeader;
  /**
   * An array of CompactID structures (section 2.2.2) where each element in the array specifies the identity of an object. The number of elements is equal to the value of the header.Count field.
   */
  body: CompactID[];
};

export function ObjectSpaceObjectStreamOfOSIDs(
  reader: OneNoteReader
): ObjectSpaceObjectStreamOfOSIDs {
  return ObjectSpaceObjectStreamOfOIDs(reader);
}
