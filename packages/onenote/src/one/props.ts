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

import { CompactID } from "../reader";
import { ExtendedGUID, GUID } from "../utils/guid";
import {
  OneNoteObject,
  extendedGuidToKey
} from "../onestore/object-space";
import {
  PropertySet as RawPropertySet
} from "../onestore/file-node-types/shared/PropertySet";
import { PropertyType } from "./property-type";
import { decode, fromHex, toHex } from "../utils/reader";

export type PropertyData =
  | boolean
  | number
  | { cb: number; Data: Uint8Array }
  | Uint8Array
  | CompactID
  | CompactID[]
  | { propertyId: number; propertySets: RawPropertySet[] }
  | RawPropertySet[]
  | RawPropertySet
  | null;

type IdMapping = Map<number, GUID>;

function resolveCompactId(
  mapping: IdMapping,
  id: CompactID
): ExtendedGUID | undefined {
  const guid = mapping.get(id.guidIndex);
  if (!guid) return undefined;
  return new ExtendedGUID(guid, id.n);
}

function countReferences(set: RawPropertySet): number {
  let count = 0;
  for (let i = 0; i < set.rgPrids.length; ++i) {
    const value = set.rgData[i];
    switch (set.rgPrids[i].type) {
      case 0x8: // ObjectID
        count += 1;
        break;
      case 0x9: // ArrayOfObjectIDs
        count += typeof value === "number" ? value : 0;
        break;
      case 0x10: // ArrayOfPropertyValues
        if (value && typeof value === "object" && "propertyId" in value) {
          for (const sub of value.propertySets) count += countReferences(sub);
        }
        break;
      case 0x11: // PropertySet
        if (value && typeof value === "object" && "rgData" in value) {
          count += countReferences(value as RawPropertySet);
        }
        break;
    }
  }
  return count;
}

/**
 * A wrapper over an object's raw property set that provides typed access to
 * properties, mirroring the `Object` API of the Rust onenote_parser crate.
 */
export class ObjectProps {
  constructor(
    private readonly object: OneNoteObject,
    private readonly mapping: IdMapping
  ) {}

  private get propSet() {
    return this.object.propSet;
  }

  get jcid() {
    return this.object.jcid;
  }

  get contextId() {
    return this.object.contextId;
  }

  get fileData(): Uint8Array | undefined {
    return this.object.fileData;
  }

  get fileExtension(): string | undefined {
    return this.object.fileExtension;
  }

  /** The index of the property with the given id, if present. */
  indexOf(propType: PropertyType): number {
    const id = propType & 0x3ffffff;
    return this.propSet.body.rgPrids.findIndex((p) => p.id === id);
  }

  /** Returns the raw property value at the given index. */
  valueAt(index: number): PropertyData | undefined {
    if (index < 0) return undefined;
    return this.propSet.body.rgData[index];
  }

  has(propType: PropertyType): boolean {
    return this.indexOf(propType) > -1;
  }

  getBool(propType: PropertyType): boolean | undefined {
    const index = this.indexOf(propType);
    if (index < 0) return undefined;
    const value = this.propSet.body.rgData[index];
    if (typeof value !== "boolean") return undefined;
    return value;
  }

  getBoolOrDefault(propType: PropertyType, def = false): boolean {
    return this.getBool(propType) ?? def;
  }

  getU8(propType: PropertyType): number | undefined {
    const value = this.getNumber(propType);
    return value === undefined ? undefined : value;
  }

  getU16(propType: PropertyType): number | undefined {
    return this.getNumber(propType);
  }

  getU32(propType: PropertyType): number | undefined {
    return this.getNumber(propType);
  }

  getU64(propType: PropertyType): number | undefined {
    return this.getNumber(propType);
  }

  /** A lossless u8 conversion accepting any integer width. */
  getU8Lossless(propType: PropertyType): number | undefined {
    const value = this.getNumber(propType);
    if (value === undefined || value < 0 || value > 0xff) return undefined;
    return value;
  }

  private getNumber(propType: PropertyType): number | undefined {
    const index = this.indexOf(propType);
    if (index < 0) return undefined;
    const value = this.propSet.body.rgData[index];
    if (typeof value === "number") return value;
    if (value instanceof Uint8Array) {
      let result = 0;
      for (let i = 0; i < value.length && i < 6; ++i) {
        result += value[i] * 2 ** (i * 8);
      }
      if (value.length >= 8) {
        // 64-bit values beyond 2^53 lose precision but are not used as
        // exact integers by the parser.
        let high = 0;
        for (let i = 6; i < value.length; ++i) {
          high += value[i] * 2 ** ((i - 6) * 8);
        }
        result += high * 2 ** 48;
      }
      return result;
    }
    return undefined;
  }

  /** Parse a 4-byte property as an f32. */
  getF32(propType: PropertyType): number | undefined {
    const index = this.indexOf(propType);
    if (index < 0) return undefined;
    const value = this.propSet.body.rgData[index];
    if (value instanceof Uint8Array && value.length === 4) {
      return new DataView(
        value.buffer,
        value.byteOffset,
        value.byteLength
      ).getFloat32(0, true);
    }
    if (typeof value !== "number") return undefined;
    const buffer = new ArrayBuffer(4);
    new DataView(buffer).setUint32(0, value, true);
    return new DataView(buffer).getFloat32(0, true);
  }

  getVec(propType: PropertyType): Uint8Array | undefined {
    const index = this.indexOf(propType);
    if (index < 0) return undefined;
    const value = this.propSet.body.rgData[index];
    if (value instanceof Uint8Array) return value;
    if (value && typeof value === "object" && "cb" in value)
      return (value as { Data: Uint8Array }).Data;
    return undefined;
  }

  getVecU16(propType: PropertyType): number[] | undefined {
    const data = this.getVec(propType);
    if (!data) return undefined;
    const result: number[] = [];
    for (let i = 0; i + 1 < data.length; i += 2) {
      result.push(data[i] | (data[i + 1] << 8));
    }
    return result;
  }

  getVecU32(propType: PropertyType): number[] | undefined {
    const data = this.getVec(propType);
    if (!data) return undefined;
    const result: number[] = [];
    for (let i = 0; i + 4 <= data.length; i += 4) {
      result.push(
        (data[i] |
          (data[i + 1] << 8) |
          (data[i + 2] << 16) |
          (data[i + 3] << 24)) >>>
          0
      );
    }
    return result;
  }

  getVecI32(propType: PropertyType): number[] | undefined {
    const data = this.getVec(propType);
    if (!data) return undefined;
    const result: number[] = [];
    for (let i = 0; i + 4 <= data.length; i += 4) {
      result.push(
        (data[i] |
          (data[i + 1] << 8) |
          (data[i + 2] << 16) |
          (data[i + 3] << 24)) |
          0
      );
    }
    return result;
  }

  getVecF32(propType: PropertyType): number[] | undefined {
    const data = this.getVec(propType);
    if (!data) return undefined;
    const result: number[] = [];
    for (let i = 0; i + 4 <= data.length; i += 4) {
      const view = new DataView(
        data.buffer,
        data.byteOffset + i,
        4
      );
      result.push(view.getFloat32(0, true));
    }
    return result;
  }

  getString(propType: PropertyType): string | undefined {
    const data = this.getVec(propType);
    if (!data) return undefined;
    // OneNote stores strings as UTF-16 with a trailing NUL terminator.
    return decode(data, "utf16le").replace(/\0+$/g, "");
  }

  getAscii(propType: PropertyType): string | undefined {
    const data = this.getVec(propType);
    if (!data) return undefined;
    return decode(data, "latin1");
  }

  getGuid(propType: PropertyType): GUID | undefined {
    const data = this.getVec(propType);
    if (!data) return undefined;
    return GUID.fromBuffer(data);
  }

  getGuidString(propType: PropertyType): string | undefined {
    return this.getGuid(propType)?.toString();
  }

  /** A single object reference, resolved to the object's ID. */
  objectRef(propType: PropertyType): string | undefined {
    const offset = this.objectIdOffset(propType);
    if (offset === undefined) return undefined;
    const id = this.propSet.OIDs.body[offset];
    if (!id) return undefined;
    const resolved = resolveCompactId(this.mapping, id);
    return resolved ? extendedGuidToKey(resolved) : undefined;
  }

  objectRefs(propType: PropertyType): string[] {
    const index = this.indexOf(propType);
    if (index < 0) return [];
    const value = this.propSet.body.rgData[index];
    const count = Array.isArray(value)
      ? value.length
      : typeof value === "number"
      ? value
      : 0;
    const offset = this.objectIdOffset(propType) ?? 0;
    const result: string[] = [];
    for (let i = 0; i < count; ++i) {
      const id = this.propSet.OIDs.body[offset + i];
      if (!id) continue;
      const resolved = resolveCompactId(this.mapping, id);
      if (resolved) result.push(extendedGuidToKey(resolved));
    }
    return result;
  }

  objectSpaceRefs(propType: PropertyType): string[] {
    const index = this.indexOf(propType);
    if (index < 0) return [];
    const value = this.propSet.body.rgData[index];
    const count = Array.isArray(value)
      ? value.length
      : typeof value === "number"
      ? value
      : 0;
    const offset = this.objectSpaceIdOffset(propType) ?? 0;
    const result: string[] = [];
    const osids = this.propSet.OSIDs?.body ?? [];
    for (let i = 0; i < count; ++i) {
      const id = osids[offset + i];
      if (!id) continue;
      const resolved = resolveCompactId(this.mapping, id);
      if (resolved) result.push(extendedGuidToKey(resolved));
    }
    return result;
  }

  private objectIdOffset(propType: PropertyType): number | undefined {
    if (!this.has(propType)) return undefined;
    const index = this.indexOf(propType);
    let offset = 0;
    for (let i = 0; i < index; ++i) {
      const propertyId = this.propSet.body.rgPrids[i];
      const value = this.propSet.body.rgData[i];
      switch (propertyId.type) {
        case 0x8: // ObjectID
          offset += 1;
          break;
        case 0x9: // ArrayOfObjectIDs
          offset += Array.isArray(value)
            ? value.length
            : typeof value === "number"
            ? value
            : 0;
          break;
        case 0x10: // ArrayOfPropertyValues
          if (value && typeof value === "object" && "propertyId" in value) {
            for (const set of value.propertySets) {
              offset += countReferences(set);
            }
          }
          break;
        case 0x11: // PropertySet
          if (value && typeof value === "object" && "rgData" in value) {
            offset += countReferences(value as RawPropertySet);
          }
          break;
      }
    }
    return offset;
  }

  private objectSpaceIdOffset(propType: PropertyType): number | undefined {
    if (!this.has(propType)) return undefined;
    const index = this.indexOf(propType);
    let offset = 0;
    for (let i = 0; i < index; ++i) {
      const propertyId = this.propSet.body.rgPrids[i];
      const value = this.propSet.body.rgData[i];
      switch (propertyId.type) {
        case 0xa: // ObjectSpaceID
          offset += 1;
          break;
        case 0xb: // ArrayOfObjectSpaceIDs
          offset += Array.isArray(value)
            ? value.length
            : typeof value === "number"
            ? value
            : 0;
          break;
        case 0x10: // ArrayOfPropertyValues
          if (value && typeof value === "object" && "propertyId" in value) {
            for (const set of value.propertySets) {
              offset += countPropertySetSpaceRefs(set);
            }
          }
          break;
        case 0x11: // PropertySet
          if (value && typeof value === "object" && "rgData" in value) {
            offset += countPropertySetSpaceRefs(value as RawPropertySet);
          }
          break;
      }
    }
    return offset;
  }

  /** A property containing an array of property sets (e.g. note tags, text runs). */
  propertyValues(
    propType: PropertyType
  ): { propertyId: number; propertySets: RawPropertySet[] } | undefined {
    const index = this.indexOf(propType);
    if (index < 0) return undefined;
    const value = this.propSet.body.rgData[index];
    if (value && typeof value === "object" && "propertyId" in value)
      return value as { propertyId: number; propertySets: RawPropertySet[] };
    return undefined;
  }

  /**
   * Create a sub-object for a property set (used for text runs, note tags, etc).
   * The sub-object inherits the context, file data and ID mapping but has the
   * given property set and a slice of the parent's object ID stream, mirroring
   * the Rust `parse_object` implementation.
   */
  subObject(
    parentPropType: PropertyType,
    propertyId: number,
    props: RawPropertySet
  ): ObjectProps {
    const oidOffset = this.objectIdOffset(parentPropType) ?? 0;
    const oidCount = countReferences(props);
    const spaceOffset = this.objectSpaceIdOffset(parentPropType) ?? 0;
    const spaceCount = countPropertySetSpaceRefs(props);

    return new ObjectProps(
      {
        contextId: this.contextId,
        jcid: {
          id: propertyId,
          index: propertyId & 0xffff,
          isBinary: ((propertyId >> 16) & 0x1) === 1,
          isPropertySet: ((propertyId >> 17) & 0x1) === 1,
          isGraphNode: ((propertyId >> 18) & 0x1) === 1,
          isFileData: ((propertyId >> 19) & 0x1) === 1,
          isReadOnly: ((propertyId >> 20) & 0x1) === 1
        },
        propSet: {
          OIDs: {
            header: this.propSet.OIDs.header,
            body: this.propSet.OIDs.body.slice(oidOffset, oidOffset + oidCount)
          },
          OSIDs: this.propSet.OSIDs
            ? {
                header: this.propSet.OSIDs.header,
                body: this.propSet.OSIDs.body.slice(
                  spaceOffset,
                  spaceOffset + spaceCount
                )
              }
            : undefined,
          ContextIDs: this.propSet.ContextIDs,
          body: props
        },
        mapping: this.mapping,
        fileData: this.object.fileData,
        fileDataReference: this.object.fileDataReference,
        fileExtension: this.object.fileExtension,
        odcs: 0
      },
      this.mapping
    );
  }
}

function countPropertySetSpaceRefs(set: RawPropertySet): number {
  let count = 0;
  for (let i = 0; i < set.rgPrids.length; ++i) {
    const value = set.rgData[i];
    switch (set.rgPrids[i].type) {
      case 0xa:
        count += 1;
        break;
      case 0xb:
        count += typeof value === "number" ? value : 0;
        break;
      case 0x10:
        if (value && typeof value === "object" && "propertyId" in value) {
          for (const sub of value.propertySets) {
            count += countPropertySetSpaceRefs(sub);
          }
        }
        break;
      case 0x11:
        if (value && typeof value === "object" && "rgData" in value) {
          count += countPropertySetSpaceRefs(value as RawPropertySet);
        }
        break;
    }
  }
  return count;
}

export { toHex, fromHex };
