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
 * The {@link ObjectSpaceObjectStreamHeader} structure specifies the number of objects (see section 2.1.5) in a stream and whether there are more streams following the stream that contains this ObjectSpaceObjectStreamHeader structure
 */
export type ObjectSpaceObjectStreamHeader = {
  /**
   * An unsigned integer that specifies the number of CompactID structures (section 2.2.2) in the stream that contains this ObjectSpaceObjectStreamHeader structure.
   */
  count: number;

  /**
   * A bit that specifies whether the {@link ObjectSpaceObjectPropSet} structure (section 2.6.1) contains any additional streams of data following this stream of data.
   */
  ExtendedStreamsPresent: boolean;

  /**
   * A bit that specifies whether the {@link ObjectSpaceObjectPropSet} structure does not contain OSIDs or ContextIDs fields.
   */
  OsidStreamNotPresent: boolean;
};

export function ObjectSpaceObjectStreamHeader(
  reader: OneNoteReader
): ObjectSpaceObjectStreamHeader {
  const data = reader.deserializeInt();
  return {
    count: data & 0xffffff,
    ExtendedStreamsPresent: ((data >> 30) & 1) == 1,
    OsidStreamNotPresent: ((data >> 31) & 1) == 1,
  };
}
