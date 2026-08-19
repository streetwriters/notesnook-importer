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
import { ElementChildNodesOfSection } from "./ElementChildNodesOfSection";
import { NotebookManagementEntityGuid } from "./NotebookManagementEntityGuid";
import { TopologyCreationTimeStamp } from "./TopologyCreationTimeStamp";

/**
 * The jcidSectionNode structure specifies the properties of a section (section 1.3.1). The value of the JCID element, as specified in [MS-ONESTORE], for this property set is "0x00060007".
 */
export type SectionNode = {
  /**
   * A NotebookManagementEntityGuid element (section 2.2.58) that specifies the identifier of the section. This value SHOULD<1> be ignored.
   */
  guid: NotebookManagementEntityGuid;

  /**
   * An ElementChildNodesOfSection element (section 2.2.48) that specifies the child nodes of the section.
   */
  childNodes: ElementChildNodesOfSection;

  /**
   * A TopologyCreationTimeStamp element (section 2.3.32) that specifies when the section was created
   */
  timestamp: TopologyCreationTimeStamp;
};

// export function GlobalIdTableStartFNDX(
//   reader: OneNoteReader
// ): GlobalIdTableStartFNDX {
//   const reserved = reader.deserializeByte();
//   return {};
// }
