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
import { toBase64 } from "../../../utils/reader";
import { FileChunkReference } from "../../../utils/file-chunk-reference";
import { GUID } from "../../../utils/guid";

/**
 * The {@link FileDataStoreObject} structure specifies the data for a file data object.
 */
export type FileDataStoreObject = {
  /**
   * A GUID, as specified by [MS-DTYP], that specifies the beginning of a FileDataStoreObject. MUST be {BDE316E7-2665-4511-A4C4-8D4D0B7A9EAC}.
   */
  guidHeader: GUID;

  /**
   * An unsigned integer that specifies the size, in bytes, of the FileData field without padding.
   */
  cbLength: number;

  /**
   * A stream of bytes that specifies the data for the file data object. Padding is added to the end of the FileData stream to ensure that the {@link FileDataStoreObject} structure ends on an 8-byte boundary.
   */
  fileData: string;

  /**
   * A GUID, as specified by [MS-DTYP], that specifies the end of a {@link FileDataStoreObject} structure. MUST be {71FBA722-0F79-4A0B-BB13-899256426B24}.
   */
  guidFooter: GUID;
};

export function FileDataStoreObject(
  reader: OneNoteReader,
  ref: FileChunkReference<unknown, unknown>
): FileDataStoreObject {
  const guidHeader = reader.deserializeGUID();
  const cbLength = reader.deserializeLong();
  const unused = reader.deserializeBytes(4);
  const reserved = reader.deserializeBytes(8);
  const fileData = toBase64(reader.deserializeBytes(cbLength));

  reader.seek(Number(ref.stp) + Number(ref.cb) - 16);
  const guidFooter = reader.deserializeGUID();
  return { guidHeader, cbLength, fileData, guidFooter };
}
