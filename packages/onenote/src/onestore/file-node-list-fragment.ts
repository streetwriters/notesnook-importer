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

import { OneNoteReader } from "../reader";
import { FileChunkReference64x32 } from "../utils/file-chunk-reference";
import { mustMatch, property } from "../utils/validators";
import { FileNode } from "./file-node";
import { FileNodeListHeader } from "./file-node-list-header";
import { FileNodeID } from "./file-node-types";

/**
 * The {@link FileNodeListFragment} structure specifies a sequence of file nodes from a file node list (section 2.4). The size of the {@link FileNodeListFragment} structure is specified by the structure that references it.
 *
 * All fragments in the same file node list MUST have the same FileNodeListFragment.header.FileNodeListID field.
 */
export class FileNodeListFragment {
  /**
   * A {@link FileNodeListHeader} structure (section 2.4.2).
   */
  readonly header: FileNodeListHeader;

  /**
   * A stream of bytes that contains a sequence of FileNode structures (section 2.4.3). The stream is terminated when any of the following conditions is met:
   *
   * - The number of bytes between the end of the last read FileNode and the nextFragment field is less than 4 bytes.
   * - A {@link FileNode} structure with a FileNodeID field value equal to 0x0FF (ChunkTerminatorFND structure, section 2.4.3) is read. If a {@link ChunkTerminatorFND} structure is present, the value of the nextFragment field MUST be a valid FileChunkReference64x32 structure (section 2.2.4.4) to the next FileNodeListFragment structure.
   * - The number of FileNode structures read for the containing file node list is equal to the number of nodes specified for the list by the transaction log (section 2.3.3) in the last TransactionEntry (section 2.3.3.2) that modified the list. In this case the nextFragment field MUST be ignored.
   */
  readonly rgFileNodes: FileNode[];

  /**
   * A {@link FileChunkReference64x32} structure (section 2.2.4.4) that specifies whether there are more fragments in this file node list, and if so, the location and size of the next fragment.
   *
   * If this is the last fragment, the value of the nextFragment field MUST be "fcrNil" (see section 2.2.4). Otherwise the value of the {@link FileChunkReference64x32.stp|nextFragment.stp} field MUST specify the location of a valid {@link FileNodeListFragment} structure, and the value of the {@link FileChunkReference64x32.cb|nextFragment.cb} field MUST be equal to the size of the referenced fragment including the {@link FileNodeListFragment.header} field and the {@link FileNodeListFragment.footer} field.
   *
   * The location of the nextFragment field is calculated by adding the size of this {@link FileNodeListFragment} structure minus the size of the nextFragment and footer fields to the location of this {@link FileNodeListFragment} structure.
   */
  readonly nextFragment: FileChunkReference64x32;

  /**
   * An unsigned integer; MUST be "0x8BC215C38233BA4B". Specifies the end of the {@link FileNodeListFragment} structure.
   */
  readonly footer: number;

  constructor(reader: OneNoteReader, end: number) {
    this.rgFileNodes = [];
    this.header = new FileNodeListHeader(reader);

    // while there are at least 24 bytes free
    // 24 = sizeof(nextFragment) [12 bytes] + sizeof(footer) [8 bytes]
    // + 4 bytes for the FileNode header
    while (reader.position + 24 <= end) {
      const fileNode = new FileNode(reader);
      this.rgFileNodes.push(fileNode);
      if (
        fileNode.FileNodeID === FileNodeID.ChunkTerminatorFND ||
        fileNode.FileNodeID === FileNodeID.UnknownFND
      )
        break;
    }

    reader.seek(end - 20);

    this.nextFragment = reader.readFileChunkReference64x32();
    this.footer = reader.deserializeLong();
    mustMatch(0x8bc215c38233ba4b)(this, "footer");
  }
}
