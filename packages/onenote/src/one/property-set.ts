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

import { PropertyType } from "./property-type";
import { ObjectProps } from "./props";
import { GUID } from "../utils/guid";

export type PropertySetData<T> = T;

export function assertPropertySet(props: ObjectProps, expectedId: number) {
  if (props.jcid.id === expectedId) return;
  throw new Error(
    `unexpected object type: 0x${props.jcid.id.toString(16).toUpperCase()}`
  );
}

/** FILETIME: 100-nanosecond intervals since 1601-01-01 → epoch milliseconds. */
export function filetimeToMs(timestamp: number): number {
  return Math.round(timestamp / 10 / 1000 - 11644473600000);
}

/** OneNote "Time" values: seconds since 1980-01-01 → epoch milliseconds. */
export function oneNoteTimeToMs(time: number): number {
  return (time + 315532800) * 1000;
}

export function parseF32Value(value: number): number {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setUint32(0, value, true);
  return view.getFloat32(0, true);
}

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

export type Color = { alpha: number; r: number; g: number; b: number };

export function parseColor(
  props: ObjectProps,
  propType: PropertyType
): Color | undefined {
  const value = props.getU32(propType);
  if (value === undefined) return undefined;
  const bytes = toLeBytes(value, 4);
  return {
    alpha: 255 - bytes[3],
    r: bytes[0],
    g: bytes[1],
    b: bytes[2]
  };
}

export type ColorRef = { type: "auto" } | { type: "manual"; r: number; g: number; b: number };

export function parseColorRef(
  props: ObjectProps,
  propType: PropertyType
): ColorRef | undefined {
  const value = props.getU32(propType);
  if (value === undefined) return undefined;
  const bytes = toLeBytes(value, 4);
  if (bytes[3] === 0xff) return { type: "auto" };
  if (bytes[3] === 0x00)
    return { type: "manual", r: bytes[0], g: bytes[1], b: bytes[2] };
  return undefined;
}

export enum Charset {
  Ansi,
  Default,
  Symbol,
  Mac,
  ShiftJis,
  Hangul,
  Johab,
  Gb2312,
  ChineseBig5,
  Greek,
  Turkish,
  Vietnamese,
  Hebrew,
  Arabic,
  Baltic,
  Russian,
  Thai,
  EastEurope,
  Oem
}

export function parseCharset(
  props: ObjectProps,
  propType: PropertyType
): Charset | undefined {
  const value = props.getU8(propType);
  if (value === undefined) return undefined;
  switch (value) {
    case 0: return Charset.Ansi;
    case 1: return Charset.Default;
    case 2: return Charset.Symbol;
    case 77: return Charset.Mac;
    case 128: return Charset.ShiftJis;
    case 129: return Charset.Hangul;
    case 130: return Charset.Johab;
    case 134: return Charset.Gb2312;
    case 136: return Charset.ChineseBig5;
    case 161: return Charset.Greek;
    case 162: return Charset.Turkish;
    case 163: return Charset.Vietnamese;
    case 177: return Charset.Hebrew;
    case 178: return Charset.Arabic;
    case 186: return Charset.Baltic;
    case 204: return Charset.Russian;
    case 222: return Charset.Thai;
    case 238: return Charset.EastEurope;
    case 255: return Charset.Oem;
  }
  return undefined;
}

export enum ParagraphAlignment {
  Unknown = 0,
  Left = 1,
  Center = 2,
  Right = 3
}

export function parseParagraphAlignment(
  props: ObjectProps
): ParagraphAlignment | undefined {
  const value = props.getU8Lossless(PropertyType.ParagraphAlignment);
  if (value === undefined) return undefined;
  switch (value) {
    case 0: return ParagraphAlignment.Left;
    case 1: return ParagraphAlignment.Center;
    case 2: return ParagraphAlignment.Right;
    default: return ParagraphAlignment.Unknown;
  }
}

export type LayoutAlignment = {
  alignmentHorizontal: number;
  alignmentMarginHorizontal: number;
  alignmentVertical: number;
  alignmentMarginVertical: number;
};

export function parseLayoutAlignment(
  props: ObjectProps,
  propType: PropertyType
): LayoutAlignment | undefined {
  const value = props.getU32(propType);
  if (value === undefined) return undefined;
  if ((value >> 31) & 0x1) return undefined;
  return {
    alignmentHorizontal: value & 0x7,
    alignmentMarginHorizontal: (value >> 3) & 0x1,
    alignmentVertical: (value >> 16) & 0x1,
    alignmentMarginVertical: (value >> 19) & 0x1
  };
}

export type NoteTagShape = number;

const CHECKABLE_SHAPES = new Set([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
  28, 29, 30, 31, 32, 33,
  48, 49, 50, 51, 52, 53,
  69, 70, 71, 72, 73, 74,
  89, 90, 91, 92, 93,
  94, 95, 96, 97, 98, 99
]);

export function parseNoteTagShape(value: number): NoteTagShape {
  return value;
}

export function isCheckableNoteTagShape(shape: NoteTagShape): boolean {
  return CHECKABLE_SHAPES.has(shape);
}

export type NoteTagPropertyStatus = {
  hasLabel: boolean;
  hasFontColor: boolean;
  hasHighlightColor: boolean;
  hasIcon: boolean;
  dueToday: boolean;
  dueTomorrow: boolean;
  dueThisWeek: boolean;
  dueNextWeek: boolean;
  dueLater: boolean;
  dueCustom: boolean;
};

export function parseNoteTagPropertyStatus(
  props: ObjectProps
): NoteTagPropertyStatus | undefined {
  const value = props.getU32(PropertyType.NoteTagPropertyStatus);
  if (value === undefined) return undefined;
  return {
    hasLabel: (value & 0x1) !== 0,
    hasFontColor: ((value >> 1) & 0x1) !== 0,
    hasHighlightColor: ((value >> 2) & 0x1) !== 0,
    hasIcon: ((value >> 3) & 0x1) !== 0,
    dueToday: ((value >> 6) & 0x1) !== 0,
    dueTomorrow: ((value >> 7) & 0x1) !== 0,
    dueThisWeek: ((value >> 8) & 0x1) !== 0,
    dueNextWeek: ((value >> 9) & 0x1) !== 0,
    dueLater: ((value >> 10) & 0x1) !== 0,
    dueCustom: ((value >> 11) & 0x1) !== 0
  };
}

export type ActionItemStatus = {
  completed: boolean;
  disabled: boolean;
  taskTag: boolean;
};

export function parseActionItemStatus(
  props: ObjectProps
): ActionItemStatus | undefined {
  const value = props.getU16(PropertyType.ActionItemStatus);
  if (value === undefined) return undefined;
  return {
    completed: (value & 0x1) !== 0,
    disabled: ((value >> 1) & 0x1) !== 0,
    taskTag: ((value >> 2) & 0x1) !== 0
  };
}

export type ActionItemType =
  | { type: "numeric"; value: number }
  | { type: "due"; value: "today" | "tomorrow" | "thisWeek" | "nextWeek" | "noDueDate" | "custom" }
  | { type: "unknown" };

export function parseActionItemType(
  props: ObjectProps
): ActionItemType | undefined {
  const value = props.getU16(PropertyType.ActionItemType);
  if (value === undefined) return undefined;
  if (value >= 0 && value <= 99) return { type: "numeric", value };
  switch (value) {
    case 100: return { type: "due", value: "today" };
    case 101: return { type: "due", value: "tomorrow" };
    case 102: return { type: "due", value: "thisWeek" };
    case 103: return { type: "due", value: "nextWeek" };
    case 104: return { type: "due", value: "noDueDate" };
    case 105: return { type: "due", value: "custom" };
  }
  return { type: "unknown" };
}

export enum FileType {
  Unknown,
  Audio,
  Video
}

export function parseFileType(props: ObjectProps): FileType {
  const value = props.getU32(PropertyType.IRecordMedia);
  if (value === undefined) return FileType.Unknown;
  switch (value) {
    case 1: return FileType.Audio;
    case 2: return FileType.Video;
    default: return FileType.Unknown;
  }
}

export type OutlineIndentDistance = number[];

export function parseOutlineIndentDistance(
  props: ObjectProps
): OutlineIndentDistance | undefined {
  const value = props.getVec(PropertyType.RgOutlineIndentDistance);
  if (!value) return undefined;
  const count = value[0];
  const distances: number[] = [];
  for (let i = 0; i < count; ++i) {
    const view = new DataView(value.buffer, value.byteOffset + 4 + i * 4, 4);
    distances.push(view.getFloat32(0, true));
  }
  return distances;
}

function readF32Slice(data: Uint8Array): number[] {
  const result: number[] = [];
  for (let i = 0; i + 4 <= data.length; i += 4) {
    const view = new DataView(data.buffer, data.byteOffset + i, 4);
    result.push(view.getFloat32(0, true));
  }
  return result;
}

export function toLeBytes(value: number, size: number): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < size; ++i) {
    bytes.push((value >>> (i * 8)) & 0xff);
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// Property sets
// ---------------------------------------------------------------------------

export function parseSectionMetadata(props: ObjectProps) {
  assertPropertySet(props, 0x00020031);
  return {
    displayName: props.getString(PropertyType.SectionDisplayName),
    color: parseColor(props, PropertyType.SectionColor)
  };
}

export function parseSectionNode(props: ObjectProps) {
  assertPropertySet(props, 0x00060007);
  return {
    pageSeries: props.objectRefs(PropertyType.ElementChildNodes)
  };
}

export function parsePageSeriesNode(props: ObjectProps) {
  assertPropertySet(props, 0x00060008);
  const SEED = "22a8c031-3600-42ee-b714-d7acda2435e8";
  return {
    pageSpaces: props.objectSpaceRefs(PropertyType.ChildGraphSpaceElementNodes),
    pageMetadata: props
      .objectRefs(PropertyType.MetaDataObjectsAboveGraphSpace)
      .map((item) => xorExtendedGuidKey(item, SEED))
  };
}

/**
 * XOR an extended GUID key ({GUID} [n]) with a seed GUID.
 * Mirrors the Rust implementation which XORs the ExGuid (guid + n) with
 * the seed {22a8c031-3600-42ee-b714-d7acda2435e8, 0}.
 */
export function xorExtendedGuidKey(key: string, seedGuid: string): string {
  const match = /^(.*) \[(\d+)\]$/.exec(key);
  if (!match) return key;
  const guid = match[1];
  const n = Number(match[2]);

  const guidBytes = guidHexToBytes(guid);
  const seedBytes = guidHexToBytes(seedGuid);
  const result = new Array<number>(16);
  for (let i = 0; i < 16; ++i) result[i] = guidBytes[i] ^ seedBytes[i];

  const hex = result
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  const guidString = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
    12,
    16
  )}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  return `${guidString} [${n}]`;
}

function guidHexToBytes(guid: string): number[] {
  const hex = guid.replace(/-/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < 32; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16));
  }
  return bytes;
}

export function parsePageManifest(props: ObjectProps) {
  assertPropertySet(props, 0x00060037);
  const pages = props.objectRefs(PropertyType.ContentChildNodes);
  if (!pages.length) throw new Error("page manifest has no page");
  return { page: pages[0] };
}

export function parsePageMetadata(props: ObjectProps) {
  assertPropertySet(props, 0x00020030);
  const entityGuid = props.getGuidString(
    PropertyType.NotebookManagementEntityGuid
  );
  if (!entityGuid) throw new Error("page metadata has no guid");
  const timestamp = props.getU64(PropertyType.TopologyCreationTimeStamp);
  if (timestamp === undefined)
    throw new Error("page metadata has no creation timestamp");
  return {
    entityGuid,
    cachedTitle: props.getString(PropertyType.CachedTitleString),
    pageLevel: props.getU32(PropertyType.PageLevel) ?? 0,
    createdAtMs: filetimeToMs(timestamp),
    isDeleted: props.getBoolOrDefault(
      PropertyType.IsDeletedGraphSpaceContent,
      false
    )
  };
}

export function parsePageNode(props: ObjectProps) {
  assertPropertySet(props, 0x0006000b);
  const lastModified = props.getU32(PropertyType.LastModifiedTime);
  return {
    lastModifiedMs:
      lastModified === undefined ? undefined : oneNoteTimeToMs(lastModified),
    cachedTitle: props.getString(PropertyType.CachedTitleStringFromPage),
    author: props.getString(PropertyType.Author),
    content: props.objectRefs(PropertyType.ElementChildNodes),
    title: props.objectRefs(PropertyType.StructureElementChildNodes)[0],
    recognizedText: props.objectRef(
      PropertyType.PageRecognizedTextContainer
    ),
    pageWidth: props.getF32(PropertyType.PageWidth),
    pageHeight: props.getF32(PropertyType.PageHeight)
  };
}

export function parseTitleNode(props: ObjectProps) {
  assertPropertySet(props, 0x0006002c);
  const children = props.objectRefs(PropertyType.ElementChildNodes);
  if (!children.length) throw new Error("title node has no child nodes");
  return {
    children,
    offsetHorizontal: props.getF32(PropertyType.OffsetFromParentHoriz) ?? 0,
    offsetVertical: props.getF32(PropertyType.OffsetFromParentVert) ?? 0,
    layoutAlignmentInParent: parseLayoutAlignment(
      props,
      PropertyType.LayoutAlignmentInParent
    ),
    layoutAlignmentSelf: parseLayoutAlignment(
      props,
      PropertyType.LayoutAlignmentSelf
    )
  };
}

export function parseTocContainer(props: ObjectProps) {
  assertPropertySet(props, 0x00020001);
  return {
    children: props.objectRefs(PropertyType.TocChildren),
    filename: props
      .getString(PropertyType.FolderChildFilename)
      ?.replace("^M", "+")
      ?.replace("^J", ","),
    orderingId: props.getU32(PropertyType.NotebookElementOrderingId),
    color: parseColor(props, PropertyType.SectionColor)
  };
}

export function parseOutlineNode(props: ObjectProps) {
  assertPropertySet(props, 0x0006000c);
  const childLevel = props.getU8(PropertyType.OutlineElementChildLevel);
  if (childLevel === undefined)
    throw new Error("outline node has no child level");
  const indents = parseOutlineIndentDistance(props);
  if (!indents) throw new Error("outline node has no outline indent distance");
  return {
    children: props.objectRefs(PropertyType.ElementChildNodes),
    childLevel,
    indents,
    listSpacing: props.getF32(PropertyType.ListSpacingMu),
    alignmentInParent: parseLayoutAlignment(
      props,
      PropertyType.LayoutAlignmentInParent
    ),
    alignmentSelf: parseLayoutAlignment(
      props,
      PropertyType.LayoutAlignmentSelf
    ),
    layoutMaxHeight: props.getF32(PropertyType.LayoutMaxHeight),
    layoutMaxWidth: props.getF32(PropertyType.LayoutMaxWidth),
    layoutReservedWidth: props.getF32(
      PropertyType.LayoutOutlineReservedWidth
    ),
    layoutMinimumOutlineWidth: props.getF32(
      PropertyType.LayoutMinimumOutlineWidth
    ),
    isLayoutSizeSetByUser: props.getBoolOrDefault(
      PropertyType.IsLayoutSizeSetByUser,
      false
    ),
    offsetHorizontal: props.getF32(PropertyType.OffsetFromParentHoriz),
    offsetVertical: props.getF32(PropertyType.OffsetFromParentVert)
  };
}

export function parseOutlineGroup(props: ObjectProps) {
  assertPropertySet(props, 0x00060019);
  const childLevel = props.getU8(PropertyType.OutlineElementChildLevel);
  if (childLevel === undefined)
    throw new Error("outline group has no child level");
  return {
    children: props.objectRefs(PropertyType.ElementChildNodes),
    childLevel
  };
}

export function parseOutlineElementNode(props: ObjectProps) {
  assertPropertySet(props, 0x0006000d);
  const childLevel = props.getU8(PropertyType.OutlineElementChildLevel);
  if (childLevel === undefined)
    throw new Error("outline element has no child element level");
  return {
    children: props.objectRefs(PropertyType.ElementChildNodes),
    childLevel,
    contents: props.objectRefs(PropertyType.ContentChildNodes),
    listContents: props.objectRefs(PropertyType.ListNodes),
    listSpacing: props.getF32(PropertyType.ListSpacingMu)
  };
}

export function parseRichTextNode(props: ObjectProps) {
  assertPropertySet(props, 0x0006000e);
  const text =
    props.getString(PropertyType.RichEditTextUnicode) ??
    props.getAscii(PropertyType.TextExtendedAscii);
  return {
    text,
    textRunFormatting: props.objectRefs(PropertyType.TextRunFormatting),
    textRunIndices: props.getVecU32(PropertyType.TextRunIndex) ?? [],
    textRunDataObject: props.objectRefs(PropertyType.TextRunDataObject),
    paragraphStyle: props.objectRef(PropertyType.ParagraphStyle),
    paragraphSpaceBefore:
      props.getF32(PropertyType.ParagraphSpaceBefore) ?? 0,
    paragraphSpaceAfter:
      props.getF32(PropertyType.ParagraphSpaceAfter) ?? 0,
    paragraphLineSpacingExact: props.getF32(
      PropertyType.ParagraphLineSpacingExact
    ),
    paragraphAlignment:
      parseParagraphAlignment(props) ?? ParagraphAlignment.Left,
    layoutAlignmentInParent: parseLayoutAlignment(
      props,
      PropertyType.LayoutAlignmentInParent
    ),
    layoutAlignmentSelf: parseLayoutAlignment(
      props,
      PropertyType.LayoutAlignmentSelf
    ),
    noteTags: parseNoteTagContainers(props)
  };
}

export type ParagraphStyleData = {
  charset?: Charset;
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
  textRunIsEmbeddedObject: boolean;
  textRunObjectType?: number;
};

const FALLBACK_STYLE: ParagraphStyleData = {
  charset: Charset.Ansi,
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  superscript: false,
  subscript: false,
  font: undefined,
  fontSize: undefined,
  fontColor: undefined,
  highlight: undefined,
  nextStyle: undefined,
  styleId: undefined,
  paragraphAlignment: undefined,
  paragraphSpaceBefore: undefined,
  paragraphSpaceAfter: undefined,
  paragraphLineSpacingExact: undefined,
  languageCode: 1033,
  mathFormatting: false,
  hyperlink: false,
  hyperlinkProtected: false,
  hidden: false,
  textRunIsEmbeddedObject: false,
  textRunObjectType: undefined
};

export function parseParagraphStyleObject(props: ObjectProps): ParagraphStyleData {
  if (props.jcid.id !== 0x0012004d) {
    return FALLBACK_STYLE;
  }

  return {
    charset: parseCharset(props, PropertyType.Charset),
    bold: props.getBoolOrDefault(PropertyType.Bold, false),
    italic: props.getBoolOrDefault(PropertyType.Italic, false),
    underline: props.getBoolOrDefault(PropertyType.Underline, false),
    strikethrough: props.getBoolOrDefault(PropertyType.Strikethrough, false),
    superscript: props.getBoolOrDefault(PropertyType.Superscript, false),
    subscript: props.getBoolOrDefault(PropertyType.Subscript, false),
    font: props.getString(PropertyType.Font),
    fontSize: props.getU16(PropertyType.FontSize),
    fontColor: parseColorRef(props, PropertyType.FontColor),
    highlight: parseColorRef(props, PropertyType.Highlight),
    nextStyle: props.getString(PropertyType.NextStyle),
    styleId: props.getString(PropertyType.ParagraphStyleId),
    paragraphAlignment: parseParagraphAlignment(props),
    paragraphSpaceBefore: props.getF32(PropertyType.ParagraphSpaceBefore),
    paragraphSpaceAfter: props.getF32(PropertyType.ParagraphSpaceAfter),
    paragraphLineSpacingExact: props.getF32(
      PropertyType.ParagraphLineSpacingExact
    ),
    languageCode: props.getU32(PropertyType.LanguageId),
    mathFormatting: props.getBoolOrDefault(PropertyType.MathFormatting, false),
    hyperlink: props.getBoolOrDefault(PropertyType.Hyperlink, false),
    hyperlinkProtected: props.getBoolOrDefault(
      PropertyType.HyperlinkProtected,
      false
    ),
    hidden: props.getBoolOrDefault(PropertyType.Hidden, false),
    textRunIsEmbeddedObject: props.getBoolOrDefault(
      PropertyType.TextRunIsEmbeddedObject,
      false
    ),
    textRunObjectType: props.getU32(PropertyType.EmbeddedObjectType)
  };
}

export type NoteTagContainerData = {
  definition?: string;
  completedAtMs?: number;
  itemStatus: ActionItemStatus;
};

export function parseNoteTagContainers(
  props: ObjectProps
): NoteTagContainerData[] {
  const value = props.propertyValues(PropertyType.NoteTags);
  if (!value) return [];
  return value.propertySets.map((set) => {
    const sub = props.subObject(PropertyType.NoteTags, value.propertyId, set);
    const itemStatus = parseActionItemStatus(sub);
    if (!itemStatus) throw new Error("note tag container has no item status");
    const completedAt = sub.getU32(PropertyType.NoteTagCompleted);
    return {
      definition: sub.objectRef(PropertyType.NoteTagDefinitionOid),
      completedAtMs:
        completedAt === undefined ? undefined : oneNoteTimeToMs(completedAt),
      itemStatus
    };
  });
}

export function parseNoteTagSharedDefinitionContainer(props: ObjectProps) {
  assertPropertySet(props, 0x00120043);
  return {
    label: props.getString(PropertyType.NoteTagLabel) ?? "",
    status:
      parseNoteTagPropertyStatus(props) ?? {
        hasLabel: false,
        hasFontColor: false,
        hasHighlightColor: false,
        hasIcon: false,
        dueToday: false,
        dueTomorrow: false,
        dueThisWeek: false,
        dueNextWeek: false,
        dueLater: false,
        dueCustom: false
      },
    shape: parseNoteTagShape(props.getU16(PropertyType.NoteTagShape) ?? 0),
    highlightColor: parseColorRef(props, PropertyType.NoteTagHighlightColor),
    textColor: parseColorRef(props, PropertyType.NoteTagTextColor),
    actionItemType: parseActionItemType(props) ?? { type: "unknown" as const }
  };
}

export function parseNumberListNode(props: ObjectProps) {
  assertPropertySet(props, 0x00060012);
  const listFormat = props
    .getVecU16(PropertyType.NumberListFormat)
    ?.slice(1)
    .map((c) => String.fromCharCode(c));
  if (!listFormat) throw new Error("number list has no list format");
  return {
    listFont: props.getString(PropertyType.ListFont),
    listRestart: props.getU32(PropertyType.ListRestart),
    listFormat,
    bold: props.getBoolOrDefault(PropertyType.Bold, false),
    italic: props.getBoolOrDefault(PropertyType.Italic, false),
    font: props.getString(PropertyType.Font),
    fontSize: props.getU16(PropertyType.FontSize),
    fontColor: parseColorRef(props, PropertyType.FontColor)
  };
}

export function parseTableNode(props: ObjectProps) {
  assertPropertySet(props, 0x00060022);
  const rows = props.objectRefs(PropertyType.ElementChildNodes);
  if (!rows.length) throw new Error("table has no rows");
  const rowCount = props.getU32(PropertyType.RowCount);
  if (rowCount === undefined) throw new Error("table has no row count");
  const colCount = props.getU32(PropertyType.ColumnCount);
  if (colCount === undefined) throw new Error("table has no col count");
  return {
    rows,
    rowCount,
    colCount,
    colsLocked: props.getVec(PropertyType.TableColumnsLocked)?.slice(1) ?? [],
    colWidths: readF32Slice(
      props.getVec(PropertyType.TableColumnWidths)?.slice(1) ??
        new Uint8Array(0)
    ),
    bordersVisible: props.getBoolOrDefault(
      PropertyType.TableBordersVisible,
      true
    ),
    layoutAlignmentInParent: parseLayoutAlignment(
      props,
      PropertyType.LayoutAlignmentInParent
    ),
    layoutAlignmentSelf: parseLayoutAlignment(
      props,
      PropertyType.LayoutAlignmentSelf
    ),
    noteTags: parseNoteTagContainers(props)
  };
}

export function parseTableRowNode(props: ObjectProps) {
  assertPropertySet(props, 0x00060023);
  const cells = props.objectRefs(PropertyType.ElementChildNodes);
  if (!cells.length) throw new Error("table row has no cells");
  return { cells };
}

export function parseTableCellNode(props: ObjectProps) {
  assertPropertySet(props, 0x00060024);
  const contents = props.objectRefs(PropertyType.ElementChildNodes);
  if (!contents.length) throw new Error("table cell has no contents");
  const indents = parseOutlineIndentDistance(props);
  if (!indents) throw new Error("table cell has no outline indent distance");
  return {
    contents,
    layoutMaxWidth: props.getF32(PropertyType.LayoutMaxWidth),
    indents,
    backgroundColor: parseColor(props, PropertyType.CellBackgroundColor)
  };
}

export function parseImageNode(props: ObjectProps) {
  assertPropertySet(props, 0x00060011);
  return {
    pictureContainer: props.objectRef(PropertyType.PictureContainer),
    layoutMaxWidth: props.getF32(PropertyType.LayoutMaxWidth),
    layoutMaxHeight: props.getF32(PropertyType.LayoutMaxHeight),
    isLayoutSizeSetByUser: props.getBoolOrDefault(
      PropertyType.IsLayoutSizeSetByUser,
      false
    ),
    altText: props.getString(PropertyType.ImageAltText),
    layoutAlignmentInParent: parseLayoutAlignment(
      props,
      PropertyType.LayoutAlignmentInParent
    ),
    layoutAlignmentSelf: parseLayoutAlignment(
      props,
      PropertyType.LayoutAlignmentSelf
    ),
    imageFilename: props.getString(PropertyType.ImageFilename),
    displayedPageNumber: props.getU32(PropertyType.DisplayedPageNumber),
    text: props.getString(PropertyType.RichEditTextUnicode),
    pictureWidth: props.getF32(PropertyType.PictureWidth),
    pictureHeight: props.getF32(PropertyType.PictureHeight),
    hyperlinkUrl: props.getString(PropertyType.WzHyperlinkUrl),
    offsetHorizontal: props.getF32(PropertyType.OffsetFromParentHoriz),
    offsetVertical: props.getF32(PropertyType.OffsetFromParentVert),
    isBackground: props.getBoolOrDefault(PropertyType.IsBackground, false),
    noteTags: parseNoteTagContainers(props),
    iframe: props.objectRefs(PropertyType.ContentChildNodes)
  };
}

export function parsePictureContainer(props: ObjectProps) {
  if (props.jcid.id !== 0x00080039 && props.jcid.id !== 0x0008003a) {
    throw new Error(`unexpected object type: 0x${props.jcid.id.toString(16).toUpperCase()}`);
  }
  return {
    data: props.fileData ?? new Uint8Array(0),
    extension: props.getString(PropertyType.PictureFileExtension)
  };
}

export function parseEmbeddedFileNode(props: ObjectProps) {
  assertPropertySet(props, 0x00060035);
  return {
    pictureContainer: props.objectRef(PropertyType.PictureContainer),
    layoutMaxWidth: props.getF32(PropertyType.LayoutMaxWidth),
    layoutMaxHeight: props.getF32(PropertyType.LayoutMaxHeight),
    text: props.getString(PropertyType.RichEditTextUnicode),
    layoutAlignmentInParent: parseLayoutAlignment(
      props,
      PropertyType.LayoutAlignmentInParent
    ),
    layoutAlignmentSelf: parseLayoutAlignment(
      props,
      PropertyType.LayoutAlignmentSelf
    ),
    embeddedFileContainer: props.objectRef(
      PropertyType.EmbeddedFileContainer
    ),
    embeddedFileName: props.getString(PropertyType.EmbeddedFileName),
    sourcePath: props.getString(PropertyType.SourceFilepath),
    fileType: parseFileType(props),
    pictureWidth: props.getF32(PropertyType.PictureWidth),
    pictureHeight: props.getF32(PropertyType.PictureHeight),
    noteTags: parseNoteTagContainers(props),
    offsetHorizontal: props.getF32(PropertyType.OffsetFromParentHoriz),
    offsetVertical: props.getF32(PropertyType.OffsetFromParentVert)
  };
}

export function parseEmbeddedFileContainer(props: ObjectProps) {
  assertPropertySet(props, 0x00080036);
  if (!props.fileData) throw new Error("embedded file container has no data");
  return props.fileData;
}

export function parseInkContainer(props: ObjectProps) {
  assertPropertySet(props, 0x00060014);
  return {
    offsetHorizontal: props.getF32(PropertyType.OffsetFromParentHoriz),
    offsetVertical: props.getF32(PropertyType.OffsetFromParentVert),
    inkData: props.objectRef(PropertyType.InkData),
    children: props.objectRefs(PropertyType.ContentChildNodes),
    inkScalingX: props.getF32(PropertyType.InkScalingX),
    inkScalingY: props.getF32(PropertyType.InkScalingY)
  };
}

export function parseInkDataNode(props: ObjectProps) {
  assertPropertySet(props, 0x0002003b);
  const boundingBox = props
    .getVecI32(PropertyType.InkBoundingBox)
    ?.filter((values, index, array) => array.length === 4)
    .slice(0, 4);
  return {
    strokes: props.objectRefs(PropertyType.InkStrokes),
    boundingBox:
      boundingBox && boundingBox.length === 4
        ? {
            xMin: boundingBox[0],
            yMin: boundingBox[1],
            xMax: boundingBox[2],
            yMax: boundingBox[3]
          }
        : undefined
  };
}

export function parseInkStrokeNode(props: ObjectProps) {
  assertPropertySet(props, 0x00020047);
  const pathData = props.getVec(PropertyType.InkPath);
  if (!pathData) throw new Error("ink stroke node has no ink path");
  const path = decodeSignedMultiByte(pathData);
  const biasValue = props.getU8(PropertyType.InkBias) ?? 2;
  const properties = props.objectRef(PropertyType.InkStrokeProperties);
  if (!properties)
    throw new Error("ink stroke node has no ink stroke properties");
  return {
    path,
    bias: biasValue,
    languageCode: props.getU32(PropertyType.LanguageId),
    properties
  };
}

const X_DIMENSION_GUID = "598A6A8F-52C0-4BA0-93AF-AF357411A561";
const Y_DIMENSION_GUID = "B53F9F75-04E0-4498-A7EE-C30DBB5A9011";

export type InkDimension = {
  id: string;
  limitLower: number;
  limitUpper: number;
};

export function parseStrokePropertiesNode(props: ObjectProps) {
  assertPropertySet(props, 0x00120048);
  const inkWidth = props.getF32(PropertyType.InkHeight);
  if (inkWidth === undefined)
    throw new Error("ink stroke properties has no height");
  const inkHeight = props.getF32(PropertyType.InkWidth);
  if (inkHeight === undefined)
    throw new Error("ink stroke properties has no width");
  const dimensions: InkDimension[] = [];
  const data = props.getVec(PropertyType.InkDimensions) ?? new Uint8Array(0);
  for (let i = 0; i + 32 <= data.length; i += 32) {
    const entry = data.subarray(i, i + 32);
    const view = new DataView(entry.buffer, entry.byteOffset, 32);
    dimensions.push({
      id: GUID.fromBuffer(entry.slice(0, 16)).toString(),
      limitLower: view.getInt32(16, true),
      limitUpper: view.getInt32(20, true)
    });
  }
  return {
    aliased: props.getBoolOrDefault(PropertyType.InkAntialised, false),
    fitToCurve: props.getBoolOrDefault(PropertyType.InkFitToCurve, false),
    ignorePressure: props.getBoolOrDefault(
      PropertyType.InkIgnorePressure,
      false
    ),
    penTip: props.getU8(PropertyType.InkPenTip),
    rasterOperation: props.getU8(PropertyType.InkRasterOperation),
    transparency: props.getU8(PropertyType.InkTransparency),
    inkHeight,
    inkWidth,
    color: props.getU32(PropertyType.InkColor),
    dimensions
  };
}

export function parseEmbeddedInkContainer(props: ObjectProps) {
  return {
    spaceWidth: props.getF32(PropertyType.EmbeddedInkSpaceWidth),
    spaceHeight: props.getF32(PropertyType.EmbeddedInkSpaceHeight),
    startX: props.getF32(PropertyType.EmbeddedInkStartX),
    startY: props.getF32(PropertyType.EmbeddedInkStartY),
    height: props.getF32(PropertyType.EmbeddedInkHeight),
    width: props.getF32(PropertyType.EmbeddedInkWidth),
    offsetHoriz: props.getF32(PropertyType.EmbeddedInkOffsetHoriz),
    offsetVert: props.getF32(PropertyType.EmbeddedInkOffsetVert)
  };
}

// Handwriting recognition (OCR) property sets.
export function parseRecognizedTextChildren(props: ObjectProps): string[] {
  return props.objectRefs(PropertyType.RecognizedTextChildNodes);
}

export function parseRecognizedTextWord(props: ObjectProps) {
  const alternatives = decodeAlternatives(
    props.getVec(PropertyType.RecognizedText) ?? new Uint8Array(0)
  );
  return {
    alternatives,
    languageId: props.getU16(PropertyType.RecognizedTextLanguageId)
  };
}

function decodeAlternatives(data: Uint8Array): string[] {
  const units: number[] = [];
  for (let i = 0; i + 2 <= data.length; i += 2) {
    units.push(data[i] | (data[i + 1] << 8));
  }
  const result: string[] = [];
  let current: number[] = [];
  for (const unit of units) {
    if (unit === 0) {
      if (current.length) result.push(String.fromCharCode(...current));
      current = [];
    } else {
      current.push(unit);
    }
  }
  return result;
}

/** Decode a multi-byte encoded signed integer array per [MS-ISF]. */
export function decodeSignedMultiByte(input: Uint8Array): number[] {
  const values = decodeMultiByte(input);
  return values.map((value) => {
    const shifted = Math.floor(value / 2);
    return value & 0x1 ? -shifted : shifted;
  });
}

function decodeMultiByte(input: Uint8Array): number[] {
  const { value: length, offset } = decodeUint(input);
  const count = Math.floor(length / 2);
  const output: number[] = [];
  let index = offset;
  for (let i = 0; i < count; ++i) {
    if (index >= input.length) break;
    const decoded = decodeUint(input.subarray(index));
    index += decoded.offset;
    output.push(decoded.value);
  }
  return output;
}

function decodeUint(data: Uint8Array): { value: number; offset: number } {
  let value = 0;
  let count = 0;
  for (const byte of data) {
    const flag = (byte & 0x80) === 0x80;
    value |= (byte & 0x7f) << (count * 7);
    count += 1;
    if (!flag) break;
  }
  return { value, offset: count };
}

export { X_DIMENSION_GUID, Y_DIMENSION_GUID };
