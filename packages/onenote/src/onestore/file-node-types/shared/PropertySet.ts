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
import { ObjectSpaceObjectPropSet } from "./ObjectSpaceObjectPropSet";
import { ObjectSpaceObjectStreamOfContextIDs } from "./ObjectSpaceObjectStreamOfContextIDs";
import { ObjectSpaceObjectStreamOfOIDs } from "./ObjectSpaceObjectStreamOfOIDs";
import { ObjectSpaceObjectStreamOfOSIDs } from "./ObjectSpaceObjectStreamOfOSIDs";
import { PropertyID, PropertyType } from "./PropertyID";
import { PrtFourBytesOfLengthFollowedByData } from "./PrtFourBytesOfLengthFollowedByData";

export type PropertyValuesData = {
  propertyId: number;
  propertySets: PropertySet[];
};

export type PropertyData =
  | boolean
  | number
  | PrtFourBytesOfLengthFollowedByData
  | Uint8Array
  | CompactID
  | CompactID[]
  | PropertyValuesData
  | PropertySet[]
  | PropertySet
  | null;
/**
 * The {@link PropertySet} structure specifies the format of a property set (section 2.1.1).
 */
export type PropertySet = {
  /**
   * An unsigned integer that specifies the number of properties in this PropertySet structure.
   */
  cProperties: number;

  /**
   *  An array of PropertyID structures (section 2.6.6). The number of elements in the array is equal to the value of the cProperties field.
   */
  rgPrids: PropertyID[];

  /**
   * A stream of bytes that specifies the data for each property specified by a rgPrids array. The total size, in bytes, of the rgData field is the sum of the sizes specified by the PropertyID.type field for each property in a rgPrids array. The total size of rgData MUST be zero if no property in a rgPrids array specifies that it contains data in the rgData field.
   */
  rgData: PropertyData[];
};

export function PropertySet(
  reader: OneNoteReader,
  ids: Omit<ObjectSpaceObjectPropSet, "body" | "padding">
): PropertySet {
  const cProperties = reader.deserializeShort();
  const rgPrids = [];
  for (let i = 0; i < cProperties; ++i) {
    rgPrids.push(PropertyID(reader));
  }

  const rgData: PropertyData[] = [];
  for (let i = 0; i < cProperties; ++i) {
    const type = rgPrids[i].type;
    switch (type) {
      case PropertyType.NoData:
        rgData.push(null);
        break;
      case PropertyType.Bool:
        rgData.push(rgPrids[i].boolValue);
        break;
      case PropertyType.OneByteOfData:
        rgData.push(reader.deserializeByte());
        break;
      case PropertyType.TwoBytesOfData:
        rgData.push(reader.deserializeBytes(2));
        break;
      case PropertyType.FourBytesOfData:
        rgData.push(reader.deserializeBytes(4));
        break;
      case PropertyType.EightBytesOfData:
        rgData.push(reader.deserializeBytes(8));
        break;
      case PropertyType.FourBytesOfLengthFollowedByData:
        rgData.push(PrtFourBytesOfLengthFollowedByData(reader));
        break;
      case PropertyType.ObjectID:
        rgData.push(ids.OIDs.body[0]);
        break;
      case PropertyType.ArrayOfObjectIDs: {
        const count = reader.deserializeInt();
        rgData.push(getCompactIDs(ids.OIDs, count));
        break;
      }
      case PropertyType.ObjectSpaceID:
        if (!ids.OSIDs) break;
        rgData.push(ids.OSIDs.body[0]);
        break;
      case PropertyType.ArrayOfObjectSpaceIDs: {
        if (!ids.OSIDs) break;
        const count = reader.deserializeInt();
        rgData.push(getCompactIDs(ids.OSIDs, count));
        break;
      }
      case PropertyType.ContextID:
      case PropertyType.ObjectSpaceID:
        if (!ids.ContextIDs) break;
        rgData.push(ids.ContextIDs.body[0]);
        break;
      case PropertyType.ArrayOfContextIDs: {
        if (!ids.ContextIDs) break;
        const count = reader.deserializeInt();
        rgData.push(getCompactIDs(ids.ContextIDs, count));
        break;
      }
      case PropertyType.ArrayOfPropertyValues: {
        const cProperties = reader.deserializeInt();
        const propertyId = PropertyID(reader);
        if (cProperties > 0 && propertyId.type !== PropertyType.PropertySet)
          throw new Error(
            `Invalid property type. Must be 0x11 but got ${propertyId.type}.`
          );

        const data: PropertySet[] = [];
        for (let i = 0; i < cProperties; ++i) {
          data[i] = PropertySet(reader, ids);
        }
        rgData.push({ propertyId: propertyId.id, propertySets: data });
        break;
      }
      case PropertyType.PropertySet:
        rgData.push(PropertySet(reader, ids));
        break;
      default:
        throw new Error(`type is not valid. Type = ${type}`);
    }
  }

  return { cProperties, rgData, rgPrids };
}

function getCompactIDs(
  ids:
    | ObjectSpaceObjectStreamOfOIDs
    | ObjectSpaceObjectStreamOfOSIDs
    | ObjectSpaceObjectStreamOfContextIDs,
  count: number
): CompactID[] {
  if (!ids) return [];
  const data: CompactID[] = [];
  for (let i = 0; i < count; ++i) {
    data.push(ids.body[i]);
  }
  return data;
}
