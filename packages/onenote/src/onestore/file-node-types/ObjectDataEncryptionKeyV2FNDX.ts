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
import { FileChunkReference } from "../../utils/file-chunk-reference";
import { FileNode } from "../file-node";

/**
 * The data for a {@link FileNode} structure (section 2.4.3) that specifies that the object space (section 2.1.4) is encrypted. If any revision manifest (section 2.1.9) for an object space contains this FileNode structure, all other revision manifests for this object space MUST contain this FileNode structure, and these FileNode structures MUST point to structures with identical encryption data.
 */
export type ObjectDataEncryptionKeyV2FNDX = {
  /**
   *Specifies a {@link FileNodeChunkReference} structure (section 2.2.4.2) that refers to the {@link following} structure:
   *
   * **Header**: A 64-bit unsigned integer that MUST be 0xFB6BA385DAD1A067.
   *
   * **Encryption Data**: A variable sized array of bytes. MUST be ignored.
   *
   * **Footer**: A 64-bit unsigned integer that MUST be 0x2649294F8E198B3C.
   */
  ref: FileChunkReference<unknown, unknown>;
};

export function ObjectDataEncryptionKeyV2FNDX(
  reader: OneNoteReader,
  header: FileNode
): ObjectDataEncryptionKeyV2FNDX {
  // The chunk reference points to a blob with header 0xFB6BA385DAD1A067,
  // followed by the encryption XML, followed by footer 0x2649294F8E198B3C.
  return {
    ref: reader.readFileChunkReference(header.stpFormat, header.cbFormat)
  };
}
