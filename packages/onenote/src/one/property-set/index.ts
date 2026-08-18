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

import { JCID } from "../../reader";

export enum PropertySetId {
  AuthorContainer = 0x00120001,
  EmbeddedFileContainer = 0x00080036,
  EmbeddedFileNode = 0x00060035,
  ImageNode = 0x00060011,
  NoteTagSharedDefinitionContainer = 0x00120043,
  NumberListNode = 0x00060012,
  OutlineElementNode = 0x0006000d,
  OutlineGroup = 0x00060019,
  OutlineNode = 0x0006000c,
  PageManifestNode = 0x00060037,
  PageMetadata = 0x00020030,
  PageNode = 0x0006000b,
  PageSeriesNode = 0x00060008,
  ParagraphStyleObject = 0x0012004d,
  PictureContainer = 0x00080039,
  RevisionMetadata = 0x00020044,
  RichTextNode = 0x0006000e,
  SectionMetadata = 0x00020031,
  SectionNode = 0x00060007,
  TableCellNode = 0x00060024,
  TableNode = 0x00060022,
  TableRowNode = 0x00060023,
  TitleNode = 0x0006002c,
  TocContainer = 0x00020001,

  // Undocumented:
  XpsContainer = 0x0008003a,
  InkContainer = 0x00060014,
  InkDataNode = 0x0002003b,
  InkStrokeNode = 0x00020047,
  StrokePropertiesNode = 0x00120048,
  IFrameNode = 0x00060058,
}

export function fromJCID(id: JCID): keyof typeof PropertySetId {
  return PropertySetId[id.id] as keyof typeof PropertySetId;
}
