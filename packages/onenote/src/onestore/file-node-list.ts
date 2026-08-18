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
import { FileChunkReference } from "../utils/file-chunk-reference";
import { FileNodeListFragment } from "./file-node-list-fragment";

/**
 * A file node list is the basic logical structure used to organize data in the file. Each list logically consists of a sequence of FileNode structures (section 2.4.3) that can contain data, references to data, or references to other file node lists.
 *
 * For storage purposes a file node list can be divided into one or more FileNodeListFragment structures (section 2.4.1). Each fragment can specify whether there are more fragments in the list and the location of the next fragment. Each fragment specifies a sub-sequence of FileNode structures from the file node list.
 *
 * When specifying the structure of a specific file node list in this document, the division of the list into fragments is ignored and FileNode structures with FileNode.FileNodeID field values equal to 0x0FF ("ChunkTerminatorFND") are not specified.
 *
 * All file node list fragments in a file MUST form a tree. The Header.fcrFileNodeListRoot field (section 2.3.1) specifies the first fragment of the file node list that is the root of the tree.
 */
export class FileNodeList {
  readonly fragments: FileNodeListFragment[];
  constructor(
    reader: OneNoteReader,
    fileChunkReference: FileChunkReference<unknown, unknown>
  ) {
    if (reader.position !== Number(fileChunkReference.stp))
      reader.seek(Number(fileChunkReference.stp));

    this.fragments = [];
    let ref = fileChunkReference;
    while (true) {
      const sectionEnd = Number(ref.stp) + Number(ref.cb);
      const fragment = new FileNodeListFragment(reader, sectionEnd);
      this.fragments.push(fragment);

      if (fragment.nextFragment.isNil) break;
      ref = fragment.nextFragment;

      reader.seek(Number(fragment.nextFragment.stp));
    }
  }
}
