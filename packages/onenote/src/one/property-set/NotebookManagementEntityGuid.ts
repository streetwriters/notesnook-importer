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

import { GuidInAtom } from "./GuidInAtom";

/**
 * The NotebookManagementEntityGuid structure specifies a GUID, as defined in [MS-DTYP], for an object. The GUID can be used to construct a hyperlink to a page (section 1.3.2). It MUST NOT be used to construct a hyperlink to a section (section 1.3.1). This value MUST be set.
 */
export type NotebookManagementEntityGuid = {
  /**
   * A GuidInAtom element (section 2.2.12) that specifies the identifier of the object.
   */
  guid: GuidInAtom;
};
