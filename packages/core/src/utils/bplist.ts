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

import { parseBinary } from "plist";

export type BplistValue =
  | string
  | number
  | boolean
  | null
  | Uint8Array
  | Date
  | BplistValue[]
  | { [key: string]: BplistValue };

/**
 * Decodes a binary plist (bplist00 format) into a JavaScript value.
 *
 * Thin wrapper around `plist.parseBinary` that normalises the output:
 *   - UIDs from NSKeyedArchiver (`{ UID: n }`) are kept as-is so
 *     `unpackKeyedArchive` can distinguish references from scalars.
 *   - Returns `undefined` for data that is not a valid bplist.
 */
export function decodeBplist(data: Uint8Array): BplistValue | undefined {
  if (data.length < 8 + 32) return undefined;
  try {
    return normalizePlistValue(parseBinary(data));
  } catch {
    return undefined;
  }
}

export function extractStringsFromBplist(
  data: Uint8Array,
  maxLength = 100000
): string[] {
  const decoded = decodeBplist(data);
  const strings = new Set<string>();
  if (!decoded) return [];

  const visit = (value: BplistValue): void => {
    if (typeof value === "string") {
      if (value.length <= maxLength && value.length > 0) strings.add(value);
    } else if (Array.isArray(value)) {
      value.forEach(visit);
    } else if (value && typeof value === "object" && !(value instanceof Uint8Array) && !(value instanceof Date)) {
      Object.values(value).forEach(visit);
    }
  };

  visit(decoded);
  return Array.from(strings);
}

/**
 * Recursively normalises a value returned by `plist.parseBinary` so that:
 *   - `Uint8Array` instances pass through unchanged.
 *   - Date instances pass through unchanged.
 *   - Plain objects (dicts) are recursed into.
 *   - Arrays are recursed into.
 *   - UID objects `{ UID: n }` are preserved as-is (needed by
 *     `unpackKeyedArchive` to resolve NSKeyedArchiver references).
 */
function normalizePlistValue(value: unknown): BplistValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return value;
  }
  if (value instanceof Uint8Array || value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(normalizePlistValue);
  if (typeof value === "object") {
    // UID objects from plist: { UID: number } — keep as-is for
    // unpackKeyedArchive to recognise as object references.
    if ("UID" in value && Object.keys(value).length === 1) return value as BplistValue;
    const result: { [key: string]: BplistValue } = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = normalizePlistValue(v);
    }
    return result;
  }
  return null;
}

type KeyedArchiveObject = {
  $archiver?: string;
  $version?: number;
  $top?: Record<string, unknown>;
  $objects?: BplistValue[];
  [key: string]: unknown;
};

/**
 * Resolves an NSKeyedArchiver binary plist into a plain JavaScript structure.
 *
 * Apple's keyed archives store every object in a flat `$objects` table and
 * reference them by integer index. This walks the table the same way
 * `NSKeyedUnarchiver` does: an integer or a `{ UID: n }` object inside a
 * container is a reference, while a scalar pulled out of `$objects` is the
 * final value. Class metadata (`$class`, `$classes`, `$classname`) is dropped.
 *
 * Returns `null` if the data is not an NSKeyedArchiver.
 */
export function unpackKeyedArchive(data: Uint8Array): BplistValue | null {
  const decoded = decodeBplist(data);
  if (!decoded || typeof decoded !== "object") return null;
  const archive = decoded as KeyedArchiveObject;
  const objects = archive.$objects;
  if (!Array.isArray(objects) || !archive.$top) return null;

  const resolveReference = (index: number, seen: Set<number>): BplistValue => {
    if (seen.has(index)) return index;
    const object = objects[index];
    if (object === undefined) return null;
    return unpackValue(object, objects, new Set(seen).add(index));
  };

  const resolveContainerValue = (
    value: BplistValue,
    objects: BplistValue[],
    seen: Set<number>
  ): BplistValue => {
    // Integers and UID objects inside containers are references into `$objects`.
    if (typeof value === "number" && Number.isInteger(value)) {
      return resolveReference(value, seen);
    }
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !(value instanceof Uint8Array) &&
      !(value instanceof Date) &&
      "UID" in value &&
      typeof (value as { UID: unknown }).UID === "number"
    ) {
      return resolveReference((value as { UID: number }).UID, seen);
    }
    return unpackValue(value, objects, seen);
  };

  const unpackValue = (
    value: BplistValue,
    objects: BplistValue[],
    seen: Set<number>
  ): BplistValue => {
    if (value === "$null") return null;
    if (value === undefined) return null;
    if (Array.isArray(value)) {
      return value.map((entry) => resolveContainerValue(entry, objects, seen));
    }
    if (value && typeof value === "object") {
      if (value instanceof Uint8Array || value instanceof Date) return value;
      const result: { [key: string]: BplistValue } = {};
      for (const [key, entry] of Object.entries(value)) {
        if (key === "$class" || key.startsWith("$")) continue;
        result[key] = resolveContainerValue(entry, objects, seen);
      }
      return result;
    }
    return value;
  };

  const top: { [key: string]: BplistValue } = {};
  for (const [key, entry] of Object.entries(archive.$top)) {
    top[key] = resolveContainerValue(entry as BplistValue, objects, new Set());
  }
  return top;
}
