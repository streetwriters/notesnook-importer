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

/**
 * The data for a {@link FileNode} structure (section 2.4.3) that specifies the beginning of a global identification table (section 2.1.3). The value of the FileNode.FileNodeID field MUST be 0x021.
 */
export type GlobalIdTableStartFNDX = {};

export function GlobalIdTableStartFNDX(
  reader: OneNoteReader
): GlobalIdTableStartFNDX {
  const reserved = reader.deserializeByte();
  return {};
}
