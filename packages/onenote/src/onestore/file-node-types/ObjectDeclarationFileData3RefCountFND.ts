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

import { CompactID, JCID, OneNoteReader } from "../../reader";
import { StringInStorageBuffer } from "./shared/StringInStorageBuffer";

/**
 * The data for a {@link FileNode} structure (section 2.4.3) that specifies an object that references data for a file data object. If this object is revised, all declarations of this object MUST specify identical data. The value of the FileNode.FileNodeID field MUST be 0x072. This structure has the following format.
 */
export type ObjectDeclarationFileData3RefCountFND = {
  /**
   * A {@link CompactID} structure (section 2.2.2) that specifies the identity of this object.
   */
  oid: CompactID;
  /**
   * A {@link JCID} structure (section 2.6.14) that specifies the type of this object and the type of the data the object contains.
   */
  jcid: JCID;
  /**
   * An unsigned integer that specifies the reference count for this object (section 2.1.5).
   */
  cRef: number;
  /**
   * A {@link StringInStorageBuffer} structure (section 2.2.3) that specifies the type and the target of the reference. The value of the FileDataReference.StringData field MUST begin with one of the following strings: "<file>"; "<ifndf>"; "<invfdo>". The prefix specifies the type of the reference and the remaining part of the string specifies the target of the reference:
   *
   * 1. `<file>`: A file in the onefiles folder
   *
   * SHOULD specify a file name, including the file extension, of an existing file in the onefiles folder. The name portion of the file name MUST be a string form of a UUID, as specified in [RFC4122] section 3. The extension MUST be "onebin".
   *
   * 2. `<ifndf>`: FileDataStoreObject (section 2.6.13)
   *
   * Specifies a curly braced GUID string that MUST represent one of the FileDataStoreObjectReferenceFND.guidReference fields.
   *
   * 3. `<invfdo>`: Invalid
   *
   * Specifies that the reference is not valid. MUST be followed by an empty string.
   */
  FileDataReference: StringInStorageBuffer;

  /**
   * A StringInStorageBuffer (section 2.2.3) that specifies the file extension including period.
   */
  Extension: StringInStorageBuffer;
};

export function ObjectDeclarationFileData3RefCountFND(
  reader: OneNoteReader
): ObjectDeclarationFileData3RefCountFND {
  return {
    oid: reader.deserializeCompactId(),
    jcid: reader.deserializeJCID(),
    cRef: reader.deserializeByte(),
    FileDataReference: StringInStorageBuffer(reader),
    Extension: StringInStorageBuffer(reader),
  };
}
