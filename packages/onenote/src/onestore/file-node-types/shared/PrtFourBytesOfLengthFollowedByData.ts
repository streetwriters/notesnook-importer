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

/**
 * The {@link prtFourBytesOfLengthFollowedByData} structure specifies a container of variable-sized data used by properties in a {@link PropertySet} structure (section 2.6.7). The total size, in bytes, of prtFourBytesOfLengthFollowedByData is equal to cb + 4.
 */
export type PrtFourBytesOfLengthFollowedByData = {
  /**
   * An unsigned integer that specifies the size, in bytes, of the Data field. MUST be less than 0x40000000.
   */
  cb: number;

  /**
   * A stream of bytes that specifies the data for the property.
   */
  Data: Uint8Array;
};

export function PrtFourBytesOfLengthFollowedByData(
  reader: OneNoteReader
): PrtFourBytesOfLengthFollowedByData {
  const cb = reader.deserializeInt();
  const Data = reader.deserializeBytes(cb);
  return { cb, Data };
}
