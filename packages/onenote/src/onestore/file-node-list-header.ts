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
import { mustMatch } from "../utils/validators";

/**
 * The {@link FileNodeListHeader} structure specifies the beginning of a {@link FileNodeListFragment} structure (section 2.4.1).
 */
export class FileNodeListHeader {
  /**
   * An unsigned integer; MUST be "0xA4567AB1F5F7F4C4".
   */
  readonly uintMagic: number;

  /**
   * An unsigned integer that specifies the identity of the file node list (section 2.4) this fragment belongs to. MUST be equal to or greater than 0x00000010. The pair of FileNodeListID and nFragmentSequence fields MUST be unique relative to other FileNodeListFragment structures in the file.
   */
  readonly FileNodeListID: number;

  /**
   * An unsigned integer that specifies the index of the fragment in the file node list containing the fragment. The nFragmentSequence field of the first fragment in a given file node list MUST be 0 and the nFragmentSequence fields of all subsequent fragments in this list MUST be sequential.
   */
  readonly nFragmentSequence: number;
  constructor(reader: OneNoteReader) {
    this.uintMagic = reader.deserializeLong();
    mustMatch(0xa4567ab1f5f7f4c4)(this, "uintMagic");
    this.FileNodeListID = reader.deserializeInt();
    this.nFragmentSequence = reader.deserializeInt();
  }
}
