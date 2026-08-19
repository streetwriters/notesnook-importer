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
import { ObjectSpaceObjectStreamOfContextIDs } from "./ObjectSpaceObjectStreamOfContextIDs";
import { ObjectSpaceObjectStreamOfOIDs } from "./ObjectSpaceObjectStreamOfOIDs";
import { ObjectSpaceObjectStreamOfOSIDs } from "./ObjectSpaceObjectStreamOfOSIDs";
import { PropertySet } from "./PropertySet";

/**
 * The {@link ObjectSpaceObjectPropSet} structure specifies the data for an object, including a property set (section 2.1.1) and references to other objects, object spaces (section 2.1.4), and contexts (section 2.1.11).
 */
export type ObjectSpaceObjectPropSet = {
  /**
   * An ObjectSpaceObjectStreamOfOIDs (section 2.6.2) that specifies the count and list of objects that are referenced by this ObjectSpaceObjectPropSet. The count of referenced objects is calculated as the number of properties specified by the body field, with PropertyID equal to 0x8 plus the number of referenced objects specified by properties with PropertyID equal to 0x9, 0x10, and 0x11. This count MUST be equal to the value of OIDs.header.Count field. Properties that reference other objects MUST be matched with the {@link CompactID} structures (section 2.2.2) from OIDs.body field in the same order as the properties are listed in the body.rgPrids field.
   */
  OIDs: ObjectSpaceObjectStreamOfOIDs;

  /**
   * An optional ObjectSpaceObjectStreamOfOSIDs structure (section 2.6.3) that specifies the count and list of object spaces referenced by this ObjectSpaceObjectPropSet structure. MUST be present if the value of the OIDs.header.OsidStreamNotPresent field is false; otherwise, the OSIDs field MUST NOT be present. The count of referenced object spaces is calculated as the number of properties specified by the body field with PropertyID equal to 0xA plus the number of referenced object spaces specified by properties with PropertyID equal to 0xB, 0x10, and 0x11. This count MUST be equal to the value of OSIDs.header.Count field. Properties that reference other object spaces MUST be matched with the {@link CompactID} structures from OSIDs.body field in the same order as the properties are listed in the body.rgPrids field.
   */
  OSIDs?: ObjectSpaceObjectStreamOfOIDs;

  /**
   * An optional ObjectSpaceObjectStreamOfContextIDs (section 2.6.4) that specifies the count and list of contexts referenced by this ObjectSpaceObjectPropSet structure. MUST be present if OSIDs is present and the value of the OSIDs.header.ExtendedStreamsPresent field is true; otherwise, the ContextIDs field MUST NOT be present. The count of referenced contexts is calculated as the number of properties specified by the body field with PropertyID equal to 0xC plus the number of referenced contexts specified by properties with PropertyID equal to 0xD, 0x10, and 0x11. This count MUST be equal to the value of ContextIDs.header.Count field. Properties that reference other contexts MUST be matched with the {@link CompactID} structures from ContextIDs.body field in the same order as the properties are listed in the body.rgPrids field.
   */
  ContextIDs?: ObjectSpaceObjectStreamOfContextIDs;

  /**
   * A {@link PropertySet} structure (section 2.6.7) that specifies properties that modify this object, and how other objects relate to this object.
   */
  body: PropertySet;

  /**
   * An optional array of bytes that, if present, MUST be zero and MUST be ignored. The total size, in bytes, of an {@link ObjectSpaceObjectPropSet} structure MUST be a multiple of 8 if the padding field is present; the size of the padding field is the number of bytes necessary to ensure the total size of ObjectSpaceObjectPropSet structure is a multiple of 8. The size of the padding field MUST NOT exceed 7 bytes. If the sum of the sizes of the OIDs, OSIDs, ContextIDs, and body fields is a multiple of 8, then the padding field is not present.
   */
  padding?: Uint8Array;
};

export function ObjectSpaceObjectPropSet(
  reader: OneNoteReader
): ObjectSpaceObjectPropSet {
  const OIDs = ObjectSpaceObjectStreamOfOIDs(reader);
  const OSIDs = OIDs.header.OsidStreamNotPresent
    ? undefined
    : ObjectSpaceObjectStreamOfOSIDs(reader);
  const ContextIDs = OIDs.header.ExtendedStreamsPresent
    ? ObjectSpaceObjectStreamOfContextIDs(reader)
    : undefined;
  const body = PropertySet(reader, { OIDs, ContextIDs, OSIDs });

  return { OIDs, OSIDs, ContextIDs, body };
}
