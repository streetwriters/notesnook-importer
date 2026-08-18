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
import { ObjectDeclaration2Body } from "./shared/ObjectDeclaration2Body";

/**
 * The data for a {@link FileNode} structure (section 2.4.3) that specifies an object (section 2.1.5) with a reference count. The value of the FileNode.FileNodeID field MUST be 0x0A5
 */
export type ObjectDeclaration2LargeRefCountFND = {
  /**
   * A {@link FileNodeChunkReference} structure (section 2.2.4.2) that specifies a reference to an {@link ObjectSpaceObjectPropSet} structure (section 2.6.1).
   */
  BlobRef: FileChunkReference<unknown, unknown>;

  /**
   * An {@link ObjectDeclaration2Body} structure (section 2.6.16) that specifies the identity and other attributes of this object.
   */
  body: ObjectDeclaration2Body;

  /**
   * An unsigned integer that specifies the reference count for this object (section 2.1.5).
   */
  cRef: number;
};

export function ObjectDeclaration2LargeRefCountFND(
  reader: OneNoteReader,
  header: FileNode
): ObjectDeclaration2LargeRefCountFND {
  return {
    BlobRef: reader.readFileChunkReference(header.stpFormat, header.cbFormat),
    body: ObjectDeclaration2Body(reader),
    cRef: reader.deserializeInt(),
  };
}
