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

import { GUID } from "../../utils/guid";
import { NotebookManagementEntityGuid } from "./NotebookManagementEntityGuid";

/**
 * The jcidPageSeriesNode structure specifies the properties of a series of pages (section 1.3.2). The value of the JCID element, as specified in [MS-ONESTORE], for this property set is "0x00060008".
 */
type PageSeriesNode = {
  /**
   * A NotebookManagementEntityGuid element (section 2.2.58) that specifies the identifier of the page series.
   */
  guid: NotebookManagementEntityGuid;
};
