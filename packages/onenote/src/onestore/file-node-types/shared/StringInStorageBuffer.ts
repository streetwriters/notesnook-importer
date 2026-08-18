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
import { decode } from "../../../utils/reader";

/**
 * The {@link StringInStorageBuffer} structure is a variable-length Unicode string.
 */
export type StringInStorageBuffer = {
  /**
   * An unsigned integer that specifies the number of characters in the string. */
  cch: number;

  /**
   * An array of UTF-16 Unicode characters. The length of the array MUST be equal to the value specified by the cch field.
   */
  StringData: string;
};

export function StringInStorageBuffer(
  reader: OneNoteReader
): StringInStorageBuffer {
  const cch = reader.deserializeInt();
  const lengthInBytes = cch * 2;
  const data = reader.deserializeBytes(lengthInBytes);
  return { cch, StringData: decode(data, "utf16le") };
}
