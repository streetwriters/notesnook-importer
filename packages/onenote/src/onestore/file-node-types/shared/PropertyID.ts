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

import { OneNoteReader } from "../../../reader";

export enum PropertyType {
  /**
   * The property contains no data.
   */
  NoData = 0x1,
  /**
   * The property is a Boolean value specified by boolValue.
   */
  Bool = 0x2,
  /**
   * The property contains 1 byte of data in the PropertySet.rgData   stream field.
   */
  OneByteOfData = 0x3,
  /**
   * The property contains 2 bytes of data in the PropertySet.rgData   stream field.
   */
  TwoBytesOfData = 0x4,
  /**
   * The property contains 4 bytes of data in the PropertySet.rgData   stream field.
   */
  FourBytesOfData = 0x5,
  /**
   * The property contains 8 bytes of data in the PropertySet.rgData   stream field.
   */
  EightBytesOfData = 0x6,
  /**
   * The property contains a prtFourBytesOfLengthFollowedByData   (section 2.6.8) in the PropertySet.rgData   stream field.
   */
  FourBytesOfLengthFollowedByData = 0x7,
  /**
   * The property contains one CompactID (section 2.2.2)   in the ObjectSpaceObjectPropSet.OIDs.body stream field.
   */
  ObjectID = 0x8,
  /**
   * The property contains an array of CompactID   structures in the ObjectSpaceObjectPropSet.OIDs.body stream field. The   property contains an unsigned integer of size 4 bytes in the PropertySet.rgData   stream field that specifies the number of CompactID structures this   property contains.
   */
  ArrayOfObjectIDs = 0x9,
  /**
   * The property contains one CompactID structure   in the ObjectSpaceObjectPropSet.OSIDs.body stream field.
   */
  ObjectSpaceID = 0xa,
  /**
   * The property contains an array of CompactID   structures in the ObjectSpaceObjectPropSet.OSIDs.body stream field.   The property contains an unsigned integer of size 4 bytes in the PropertySet.rgData   stream field that specifies the number of CompactID structures this   property contains.
   */
  ArrayOfObjectSpaceIDs = 0xb,
  /**
   * The property contains one CompactID in the ObjectSpaceObjectPropSet.ContextIDs.body   stream field.
   */
  ContextID = 0xc,
  /**
   * The property contains an array of CompactID   structures in the ObjectSpaceObjectPropSet.ContextIDs.body stream   field. The property contains an unsigned integer of size 4 bytes in the PropertySet.rgData   stream field that specifies the number of CompactID structures this   property contains.
   */
  ArrayOfContextIDs = 0xd,
  /**
   * The property contains a prtArrayOfPropertyValues   (section 2.6.9) structure   in the PropertySet.rgData stream field.
   */
  ArrayOfPropertyValues = 0x10,
  /**
   * The property contains a child PropertySet   (section 2.6.7) structure   in the PropertySet.rgData stream field of the parent PropertySet.
   */
  PropertySet = 0x11,
}

/**
 * The {@link PropertyID} structure specifies the identity of a property and the size and location of the data for the property. The meaning of the data contained by a property is specified in [MS-ONE] section 2.1.12.
 */
export type PropertyID = {
  value: number;
  /**
   * An unsigned integer that specifies the identity of this property. The meanings of the id field values are specified in [MS-ONE] section 2.1.12.
   */
  id: number;
  /**
   * An unsigned integer that specifies the property type and the size and location of the data for this property.
   */
  type: PropertyType;

  /**
   * A bit that specifies the value of a Boolean property. MUST be false if the value of the type field is not equal to 0x2.
   */
  boolValue: boolean;
};

export function PropertyID(reader: OneNoteReader): PropertyID {
  const value = reader.deserializeInt();
  const id = value & 0x3ffffff;
  const type = (value >> 26) & 0x1f;
  const boolValue = ((value >> 31) & 1) == 1;
  return {
    value,
    id,
    type,
    boolValue,
  };
}
