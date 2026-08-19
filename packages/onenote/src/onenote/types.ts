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

import {
  ActionItemStatus,
  ActionItemType,
  Color,
  ColorRef,
  FileType,
  LayoutAlignment,
  NoteTagPropertyStatus,
  NoteTagShape,
  ParagraphAlignment
} from "../one/property-set";

export type { Color, ColorRef, FileType };

/** A OneNote notebook. */
export type Notebook = {
  entries: SectionEntry[];
  color?: Color;
};

export type SectionEntry =
  | { type: "section"; section: Section }
  | { type: "sectionGroup"; group: SectionGroup };

export type SectionGroup = {
  displayName: string;
  entries: SectionEntry[];
};

/** A OneNote section. */
export type Section = {
  displayName: string;
  pageSeries: PageSeries[];
  color?: Color;
};

/** A series of pages. */
export type PageSeries = {
  pages: Page[];
};

/** A OneNote page. */
export type Page = {
  linkTargetId: string;
  title?: Title;
  titleText?: string;
  level: number;
  createdAt: number;
  updatedAt?: number;
  author?: string;
  height?: number;
  contents: PageContent[];
  inkRecognition?: InkRecognition;
};

export type Title = {
  contents: Outline[];
  offsetHorizontal: number;
  offsetVertical: number;
  layoutAlignmentInParent?: LayoutAlignment;
  layoutAlignmentSelf?: LayoutAlignment;
};

export type PageContent =
  | { type: "outline"; outline: Outline }
  | { type: "image"; image: Image }
  | { type: "embeddedFile"; embeddedFile: EmbeddedFile }
  | { type: "ink"; ink: Ink }
  | { type: "unknown" };

export type Content =
  | { type: "richText"; richText: RichText }
  | { type: "table"; table: Table }
  | { type: "image"; image: Image }
  | { type: "embeddedFile"; embeddedFile: EmbeddedFile }
  | { type: "ink"; ink: Ink }
  | { type: "unknown" };

export type Outline = {
  childLevel: number;
  listSpacing?: number;
  indents: number[];
  alignmentInParent?: LayoutAlignment;
  alignmentSelf?: LayoutAlignment;
  layoutMaxHeight?: number;
  layoutMaxWidth?: number;
  layoutReservedWidth?: number;
  layoutMinimumOutlineWidth?: number;
  isLayoutSizeSetByUser: boolean;
  offsetHorizontal?: number;
  offsetVertical?: number;
  items: OutlineItem[];
};

export type OutlineItem =
  | { type: "group"; group: OutlineGroup }
  | { type: "element"; element: OutlineElement };

export type OutlineGroup = {
  childLevel: number;
  outlines: OutlineItem[];
};

export type OutlineElement = {
  contents: Content[];
  listContents: List[];
  listSpacing?: number;
  childLevel: number;
  children: OutlineItem[];
};

export type RichText = {
  text: string;
  textRunFormatting: ParagraphStyling[];
  textRunIndices: number[];
  paragraphStyle: ParagraphStyling;
  paragraphSpaceBefore: number;
  paragraphSpaceAfter: number;
  paragraphLineSpacingExact?: number;
  paragraphAlignment: ParagraphAlignment;
  layoutAlignmentInParent?: LayoutAlignment;
  layoutAlignmentSelf?: LayoutAlignment;
  noteTags: NoteTag[];
  embeddedObjects: EmbeddedObject[];
  hyperlinks: TextHyperlink[];
};

export type TextHyperlink = {
  target: string;
  start: number;
  end: number;
};

export type EmbeddedObject =
  | { type: "ink"; ink: Ink; boundingBox?: InkBoundingBox }
  | { type: "inkSpace"; width: number; height: number }
  | { type: "inkLineBreak" };

export type ParagraphStyling = {
  charset?: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  superscript: boolean;
  subscript: boolean;
  font?: string;
  fontSize?: number;
  fontColor?: ColorRef;
  highlight?: ColorRef;
  nextStyle?: string;
  styleId?: string;
  paragraphAlignment?: ParagraphAlignment;
  paragraphSpaceBefore?: number;
  paragraphSpaceAfter?: number;
  paragraphLineSpacingExact?: number;
  languageCode?: number;
  mathFormatting: boolean;
  hyperlink: boolean;
  hyperlinkProtected: boolean;
  hidden: boolean;
};

export type NoteTag = {
  completedAt?: number;
  itemStatus: ActionItemStatus;
  definition?: NoteTagDefinition;
};

export type NoteTagDefinition = {
  label: string;
  status: NoteTagPropertyStatus;
  shape: NoteTagShape;
  highlightColor?: ColorRef;
  textColor?: ColorRef;
  actionItemType: ActionItemType;
};

export type List = {
  listFont?: string;
  listRestart?: number;
  listFormat: string[];
  bold: boolean;
  italic: boolean;
  font?: string;
  fontSize?: number;
  fontColor?: ColorRef;
};

export type Table = {
  rows: number;
  cols: number;
  contents: TableRow[];
  colsLocked: Uint8Array | number[];
  colWidths: number[];
  bordersVisible: boolean;
  layoutAlignmentInParent?: LayoutAlignment;
  layoutAlignmentSelf?: LayoutAlignment;
  noteTags: NoteTag[];
};

export type TableRow = {
  contents: TableCell[];
};

export type TableCell = {
  contents: OutlineElement[];
  backgroundColor?: Color;
  layoutMaxWidth?: number;
  indents: number[];
};

export type Image = {
  data?: Uint8Array;
  extension?: string;
  layoutMaxWidth?: number;
  layoutMaxHeight?: number;
  altText?: string;
  layoutAlignmentInParent?: LayoutAlignment;
  layoutAlignmentSelf?: LayoutAlignment;
  imageFilename?: string;
  displayedPageNumber?: number;
  text?: string;
  pictureWidth?: number;
  pictureHeight?: number;
  hyperlinkUrl?: string;
  offsetHorizontal?: number;
  offsetVertical?: number;
  isBackground: boolean;
  noteTags: NoteTag[];
};

export type EmbeddedFile = {
  filename: string;
  fileType: FileType;
  data: Uint8Array;
  layoutMaxWidth?: number;
  layoutMaxHeight?: number;
  offsetHorizontal?: number;
  offsetVertical?: number;
  noteTags: NoteTag[];
};

export type Ink = {
  content: InkContent;
  boundingBox?: InkBoundingBox;
  offsetHorizontal?: number;
  offsetVertical?: number;
};

export type InkContent =
  | { type: "group"; children: Ink[] }
  | { type: "strokes"; strokes: InkStroke[] };

export type InkStroke = {
  path: InkPoint[];
  penTip?: number;
  transparency?: number;
  height: number;
  width: number;
  color?: number;
};

export type InkPoint = {
  x: number;
  y: number;
};

export type InkBoundingBox = {
  x: number;
  y: number;
  height: number;
  width: number;
};

export type InkRecognition = {
  lines: InkRecognizedLine[];
  text: string;
};

export type InkRecognizedLine = {
  words: InkRecognizedWord[];
};

export type InkRecognizedWord = {
  id: number;
  alternatives: string[];
  languageId?: number;
};
