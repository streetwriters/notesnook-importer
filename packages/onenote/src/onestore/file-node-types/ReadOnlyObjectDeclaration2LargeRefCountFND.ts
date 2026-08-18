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

import { OneNoteReader } from "../../reader";
import { toHex } from "../../utils/reader";
import { FileNode } from "../file-node";
import { ObjectDeclaration2LargeRefCountFND } from "./ObjectDeclaration2LargeRefCountFND";

/**
 * The data for a {@link FileNode} structure (section 2.4.3) that specifies an object with a reference count. If this object is revised, all declarations of this object MUST specify identical data. The value of the FileNode.FileNodeID field MUST be 0x0C5.
 */
export type ReadOnlyObjectDeclaration2LargeRefCountFND = {
  /**
   * An {@link ObjectDeclaration2LargeRefCountFND} structure (section 2.5.26) that specifies the identity and other attributes of this object (section 2.1.5). The values of the base.body.jcid.IsPropertySet and base.body.jcid.IsReadOnly fields MUST be true.
   */
  base: ObjectDeclaration2LargeRefCountFND;

  /**
   * An unsigned integer that specifies an MD5 checksum, as specified in [RFC1321], of the data referenced by the base.BlobRef field. If the referenced data is encrypted, the data MUST be decrypted and padded with zeros to an 8-byte boundary before calculating the checksum of the data.
   */
  md5Hash: string;
};

export function ReadOnlyObjectDeclaration2LargeRefCountFND(
  reader: OneNoteReader,
  header: FileNode
): ReadOnlyObjectDeclaration2LargeRefCountFND {
  return {
    base: ObjectDeclaration2LargeRefCountFND(reader, header),
    md5Hash: toHex(reader.deserializeBytes(16)),
  };
}
