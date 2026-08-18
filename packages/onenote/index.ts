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

export {
  parseOneNoteSection,
  parseOneNoteNotebook,
  parseOneNoteNotebookToc,
  sniffOneNoteFileType
} from "./src/onenote";
export { renderPage } from "./src/render";
export type { RenderOptions, ResourceResolver } from "./src/render";
export { extractOnepkg, isOnepkg } from "./src/vendor/cabinet";
export type {
  Notebook,
  Section,
  SectionEntry,
  SectionGroup,
  PageSeries,
  Page,
  PageContent,
  Content,
  Title,
  Outline,
  OutlineItem,
  OutlineGroup,
  OutlineElement,
  RichText,
  ParagraphStyling,
  TextHyperlink,
  EmbeddedObject,
  NoteTag,
  NoteTagDefinition,
  List,
  Table,
  TableRow,
  TableCell,
  Image,
  EmbeddedFile,
  Ink,
  InkContent,
  InkStroke,
  InkPoint,
  InkBoundingBox,
  InkRecognition,
  InkRecognizedLine,
  InkRecognizedWord,
  Color,
  ColorRef,
  FileType
} from "./src/onenote";
