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

import { ObjectProps } from "../one/props";
import { PropertyType } from "../one/property-type";
import { ParagraphStyleData } from "../one/property-set";
import {
  ColorRef,
  FileType,
  decodeSignedMultiByte,
  parseEmbeddedFileContainer,
  parseEmbeddedFileNode,
  parseEmbeddedInkContainer,
  parseImageNode,
  parseInkContainer,
  parseInkDataNode,
  parseInkStrokeNode,
  parseNoteTagContainers,
  parseNoteTagSharedDefinitionContainer,
  parseNumberListNode,
  parseOutlineElementNode,
  parseOutlineGroup,
  parseOutlineNode,
  parsePageManifest,
  parsePageMetadata,
  parsePageNode,
  parsePageSeriesNode,
  parseParagraphStyleObject,
  parsePictureContainer,
  parseRecognizedTextChildren,
  parseRecognizedTextWord,
  parseRichTextNode,
  parseSectionMetadata,
  parseSectionNode,
  parseStrokePropertiesNode,
  parseTableCellNode,
  parseTableNode,
  parseTableRowNode,
  parseTitleNode,
  parseTocContainer,
  X_DIMENSION_GUID,
  Y_DIMENSION_GUID
} from "../one/property-set";
import { ObjectSpace } from "../onestore/object-space";
import { OneNoteObject } from "../onestore/object-space";
import {
  Content,
  EmbeddedFile,
  EmbeddedObject,
  Image,
  Ink,
  InkBoundingBox,
  InkContent,
  InkPoint,
  InkRecognition,
  InkRecognizedLine,
  InkRecognizedWord,
  InkStroke,
  List,
  NoteTag,
  NoteTagDefinition,
  Outline,
  OutlineElement,
  OutlineGroup,
  OutlineItem,
  Page,
  PageContent,
  PageSeries,
  ParagraphStyling,
  RichText,
  Section,
  Table,
  TableCell,
  TableRow,
  TextHyperlink,
  Title
} from "./types";

export function propsOf(space: ObjectSpace, id: string): ObjectProps {
  const object = space.getObject(id);
  if (!object) throw new Error(`object ${id} is missing`);
  return new ObjectProps(object, object.mapping);
}

function getObject(space: ObjectSpace, id: string): OneNoteObject {
  const object = space.getObject(id);
  if (!object) throw new Error(`object ${id} is missing`);
  return object;
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

function parseContent(id: string, space: ObjectSpace): Content {
  const object = getObject(space, id);
  switch (object.jcid.id) {
    case 0x00060011: // ImageNode
      return { type: "image", image: parseImage(id, space) };
    case 0x00060035: // EmbeddedFileNode
      return { type: "embeddedFile", embeddedFile: parseEmbeddedFile(id, space) };
    case 0x0006000e: // RichTextNode
      return { type: "richText", richText: parseRichText(id, space) };
    case 0x00060022: // TableNode
      return { type: "table", table: parseTable(id, space) };
    case 0x00060014: // InkContainer
      return { type: "ink", ink: parseInk(id, space) };
    default:
      return { type: "unknown" };
  }
}

// ---------------------------------------------------------------------------
// Rich text
// ---------------------------------------------------------------------------

const INK_SPACE_BLOB = 0x00020026;
const INK_END_OF_LINE_BLOB = 0x00020027;
const HYPERLINK_MARKER = "\ufddfHYPERLINK \"";

const warnedMissingStyles = new Set<string>();

function parseRichText(id: string, space: ObjectSpace): RichText {
  const props = propsOf(space, id);
  const data = parseRichTextNode(props);

  const paragraphStyle = data.paragraphStyle
    ? parseStyle(
        parseParagraphStyleObject(propsOf(space, data.paragraphStyle))
      )
    : defaultStyle();

  const styleData = data.textRunFormatting.map((styleId) => {
    const object = space.getObject(styleId);
    if (!object) {
      if (!warnedMissingStyles.has(styleId)) {
        warnedMissingStyles.add(styleId);
        console.warn(`missing style for text run formatting: ${styleId}`);
      }
      return fallbackStyleData();
    }
    return parseParagraphStyleObject(new ObjectProps(object, object.mapping));
  });

  // Text run data (sub property sets containing embedded object data)
  const textRunDataProp = props.propertyValues(PropertyType.TextRunData);
  const textRunData = textRunDataProp
    ? textRunDataProp.propertySets.map((set) =>
        props.subObject(PropertyType.TextRunData, textRunDataProp.propertyId, set)
      )
    : [];

  // Embedded objects
  const embeddedObjects: EmbeddedObject[] = [];
  {
    let objectsWithoutRef = 0;
    for (let i = 0; i < textRunData.length; ++i) {
      const embeddedData = textRunData[i];
      const style = styleData[i];
      if (!style.textRunIsEmbeddedObject) continue;

      const objectRefIndex = i - objectsWithoutRef;
      const objectRef = data.textRunDataObject[objectRefIndex];

      if (style.textRunObjectType === INK_END_OF_LINE_BLOB) {
        embeddedObjects.push({ type: "inkLineBreak" });
        continue;
      }
      if (style.textRunObjectType === INK_SPACE_BLOB) {
        const embedded = parseEmbeddedInkContainer(embeddedData);
        const width = embedded.spaceWidth ?? 0;
        const height = embedded.spaceHeight ?? 0;
        embeddedObjects.push({ type: "inkSpace", width, height });
        objectsWithoutRef += 1;
        continue;
      }
      if (objectRef) {
        const ink = parseInkData(
          objectRef,
          space,
          undefined,
          undefined
        );
        const embedded = parseEmbeddedInkContainer(embeddedData);
        const boundingBox =
          embedded.startX !== undefined &&
          embedded.startY !== undefined &&
          embedded.height !== undefined &&
          embedded.width !== undefined
            ? {
                x: embedded.startX,
                y: embedded.startY,
                height: embedded.height,
                width: embedded.width
              }
            : undefined;
        embeddedObjects.push({
          type: "ink",
          ink: {
            content: { type: "strokes", strokes: ink.strokes },
            boundingBox: ink.boundingBox,
            offsetHorizontal: embedded.offsetHoriz,
            offsetVertical: embedded.offsetVert
          },
          boundingBox
        });
        continue;
      }
    }
  }

  const text = embeddedObjects.length > 0 ? "" : data.text ?? "";
  const textRunIndices = [...data.textRunIndices];
  const styles = styleData.map(parseStyle);

  fixLeadingVtMisalignment(textRunIndices, styles);

  const noteTags = parseNoteTags(data.noteTags, space);
  const hyperlinks = extractHyperlinks(text, textRunIndices, styles);

  return {
    text,
    textRunFormatting: styles,
    textRunIndices,
    paragraphStyle,
    paragraphSpaceBefore: data.paragraphSpaceBefore,
    paragraphSpaceAfter: data.paragraphSpaceAfter,
    paragraphLineSpacingExact: data.paragraphLineSpacingExact,
    paragraphAlignment: data.paragraphAlignment,
    layoutAlignmentInParent: data.layoutAlignmentInParent,
    layoutAlignmentSelf: data.layoutAlignmentSelf,
    noteTags,
    embeddedObjects,
    hyperlinks
  };
}

function fixLeadingVtMisalignment(
  indices: number[],
  styles: ParagraphStyling[]
) {
  if (indices[0] !== 1) return;
  const diff = styles.length - indices.length;
  if (diff !== 0 && diff !== 1) return;

  indices.shift();
  for (let i = 0; i < indices.length; ++i) indices[i] -= 1;
  if (diff === 1) styles.pop();
}

function extractHyperlinks(
  text: string,
  indices: number[],
  styles: ParagraphStyling[]
): TextHyperlink[] {
  const total = toUtf16Length(text);
  const runs = textRuns(total, indices, styles);
  const links: TextHyperlink[] = [];
  let searchFrom = 0;

  while (true) {
    const relativeStart = text.indexOf(HYPERLINK_MARKER, searchFrom);
    if (relativeStart === -1) break;
    const markerStart = relativeStart;
    const targetStart = markerStart + HYPERLINK_MARKER.length;
    const relativeEnd = text.indexOf('"', targetStart);
    if (relativeEnd === -1) break;
    const targetEnd = relativeEnd;
    const markerEnd = targetEnd + 1;
    searchFrom = markerEnd;

    const markerStartUtf16 = toUtf16Length(text.slice(0, markerStart));
    const markerEndUtf16 = toUtf16Length(text.slice(0, markerEnd));
    const overlapping = runs.filter(
      (run) => run.end > markerStartUtf16 && run.start < markerEndUtf16
    );
    const markerIsHiddenLink =
      overlapping.length > 0 &&
      overlapping.every((run) => run.style.hyperlink && run.style.hidden);
    if (!markerIsHiddenLink) continue;

    let first: number | undefined;
    for (let index = 0; index < runs.length; ++index) {
      const run = runs[index];
      if (run.end <= markerEndUtf16) continue;
      if (run.style.hidden && run.style.hyperlink) continue;
      if (run.style.hyperlink && !run.style.hidden) {
        first = index;
      }
      break;
    }
    if (first === undefined) continue;

    const start = Math.max(runs[first].start, markerEndUtf16);
    let end = runs[first].end;
    for (const run of runs.slice(first + 1)) {
      if (run.start !== end || !run.style.hyperlink || run.style.hidden) break;
      end = run.end;
    }
    if (start < end && targetStart < targetEnd) {
      links.push({
        target: text.slice(targetStart, targetEnd),
        start,
        end
      });
    }
  }

  return links;
}

type TextRun = {
  start: number;
  end: number;
  style: ParagraphStyling;
};

function textRuns(
  total: number,
  indices: number[],
  styles: ParagraphStyling[]
): TextRun[] {
  let start = 0;
  return styles.map((style, index) => {
    const end = Math.max(
      Math.min(indices[index] ?? total, total),
      start
    );
    const run = { start, end, style };
    start = end;
    return run;
  });
}

function toUtf16Length(text: string): number {
  let length = 0;
  for (let i = 0; i < text.length; ++i) {
    const code = text.charCodeAt(i);
    length += code >= 0xd800 && code <= 0xdbff ? 2 : 1;
  }
  return length;
}

function fallbackStyleData(): ParagraphStyleData {
  return {
    charset: undefined,
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    superscript: false,
    subscript: false,
    mathFormatting: false,
    hyperlink: false,
    hyperlinkProtected: false,
    hidden: false,
    textRunIsEmbeddedObject: false
  };
}

function defaultStyle(): ParagraphStyling {
  return {
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    superscript: false,
    subscript: false,
    mathFormatting: false,
    hyperlink: false,
    hyperlinkProtected: false,
    hidden: false
  };
}

function parseStyle(data: ParagraphStyleData): ParagraphStyling {
  return {
    charset: data.charset,
    bold: data.bold,
    italic: data.italic,
    underline: data.underline,
    strikethrough: data.strikethrough,
    superscript: data.superscript,
    subscript: data.subscript,
    font: data.font,
    fontSize: data.fontSize,
    fontColor: data.fontColor,
    highlight: data.highlight,
    nextStyle: data.nextStyle,
    styleId: data.styleId,
    paragraphAlignment: data.paragraphAlignment,
    paragraphSpaceBefore: data.paragraphSpaceBefore,
    paragraphSpaceAfter: data.paragraphSpaceAfter,
    paragraphLineSpacingExact: data.paragraphLineSpacingExact,
    languageCode: data.languageCode,
    mathFormatting: data.mathFormatting,
    hyperlink: data.hyperlink,
    hyperlinkProtected: data.hyperlinkProtected,
    hidden: data.hidden
  };
}

// ---------------------------------------------------------------------------
// Note tags
// ---------------------------------------------------------------------------

function parseNoteTags(
  containers: ReturnType<typeof parseNoteTagContainers>,
  space: ObjectSpace
): NoteTag[] {
  return containers.map((container) => ({
    completedAt: container.completedAtMs,
    itemStatus: container.itemStatus,
    definition: container.definition
      ? parseNoteTagDefinition(container.definition, space)
      : undefined
  }));
}

function parseNoteTagDefinition(
  definitionId: string,
  space: ObjectSpace
): NoteTagDefinition {
  const data = parseNoteTagSharedDefinitionContainer(
    propsOf(space, definitionId)
  );
  return {
    label: data.label,
    status: data.status,
    shape: data.shape,
    highlightColor: data.highlightColor,
    textColor: data.textColor,
    actionItemType: data.actionItemType
  };
}

// ---------------------------------------------------------------------------
// Outline
// ---------------------------------------------------------------------------

function parseOutline(id: string, space: ObjectSpace): Outline {
  const data = parseOutlineNode(propsOf(space, id));
  return {
    childLevel: data.childLevel,
    listSpacing: data.listSpacing,
    indents: data.indents,
    alignmentInParent: data.alignmentInParent,
    alignmentSelf: data.alignmentSelf,
    layoutMaxHeight: data.layoutMaxHeight,
    layoutMaxWidth: data.layoutMaxWidth,
    layoutReservedWidth: data.layoutReservedWidth,
    layoutMinimumOutlineWidth: data.layoutMinimumOutlineWidth,
    isLayoutSizeSetByUser: data.isLayoutSizeSetByUser,
    offsetHorizontal: data.offsetHorizontal,
    offsetVertical: data.offsetVertical,
    items: data.children.map((itemId) => parseOutlineItem(itemId, space))
  };
}

function parseOutlineItem(id: string, space: ObjectSpace): OutlineItem {
  const object = getObject(space, id);
  switch (object.jcid.id) {
    case 0x00060019: // OutlineGroup
      return { type: "group", group: parseOutlineGroupObject(id, space) };
    case 0x0006000d: // OutlineElementNode
      return { type: "element", element: parseOutlineElement(id, space) };
    default:
      throw new Error(`invalid outline item type: 0x${object.jcid.id.toString(16)}`);
  }
}

function parseOutlineGroupObject(id: string, space: ObjectSpace): OutlineGroup {
  const data = parseOutlineGroup(propsOf(space, id));
  return {
    childLevel: data.childLevel,
    outlines: data.children.map((itemId) => parseOutlineItem(itemId, space))
  };
}

function parseOutlineElement(id: string, space: ObjectSpace): OutlineElement {
  const data = parseOutlineElementNode(propsOf(space, id));
  return {
    childLevel: data.childLevel,
    listSpacing: data.listSpacing,
    children: data.children.map((itemId) => parseOutlineItem(itemId, space)),
    contents: data.contents.map((contentId) => parseContent(contentId, space)),
    listContents: data.listContents.map((listId) => parseList(listId, space))
  };
}

function parseList(id: string, space: ObjectSpace): List {
  const data = parseNumberListNode(propsOf(space, id));
  return {
    listFont: data.listFont,
    listRestart: data.listRestart,
    listFormat: data.listFormat,
    bold: data.bold,
    italic: data.italic,
    font: data.font,
    fontSize: data.fontSize,
    fontColor: data.fontColor
  };
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

function parseTable(id: string, space: ObjectSpace): Table {
  const data = parseTableNode(propsOf(space, id));
  return {
    rows: data.rowCount,
    cols: data.colCount,
    contents: data.rows.map((rowId) => parseRow(rowId, space)),
    colsLocked: data.colsLocked,
    colWidths: data.colWidths,
    bordersVisible: data.bordersVisible,
    layoutAlignmentInParent: data.layoutAlignmentInParent,
    layoutAlignmentSelf: data.layoutAlignmentSelf,
    noteTags: parseNoteTags(data.noteTags, space)
  };
}

function parseRow(id: string, space: ObjectSpace): TableRow {
  const data = parseTableRowNode(propsOf(space, id));
  return {
    contents: data.cells.map((cellId) => parseCell(cellId, space))
  };
}

function parseCell(id: string, space: ObjectSpace): TableCell {
  const data = parseTableCellNode(propsOf(space, id));
  return {
    contents: data.contents.map((elementId) => parseOutlineElement(elementId, space)),
    backgroundColor: data.backgroundColor,
    layoutMaxWidth: data.layoutMaxWidth,
    indents: data.indents
  };
}

// ---------------------------------------------------------------------------
// Image
// ---------------------------------------------------------------------------

function parseImage(id: string, space: ObjectSpace): Image {
  const props = propsOf(space, id);
  const node = parseImageNode(props);

  let data: Uint8Array | undefined;
  let extension: string | undefined;
  if (node.pictureContainer) {
    const container = parsePictureContainer(propsOf(space, node.pictureContainer));
    data = container.data;
    extension = container.extension;
  }

  return {
    data,
    extension,
    layoutMaxWidth: node.layoutMaxWidth,
    layoutMaxHeight: node.layoutMaxHeight,
    altText: node.altText,
    layoutAlignmentInParent: node.layoutAlignmentInParent,
    layoutAlignmentSelf: node.layoutAlignmentSelf,
    imageFilename: node.imageFilename,
    displayedPageNumber: node.displayedPageNumber,
    text: node.text,
    pictureWidth: node.pictureWidth,
    pictureHeight: node.pictureHeight,
    hyperlinkUrl: node.hyperlinkUrl,
    offsetHorizontal: node.offsetHorizontal,
    offsetVertical: node.offsetVertical,
    isBackground: node.isBackground,
    noteTags: parseNoteTags(node.noteTags, space)
  };
}

// ---------------------------------------------------------------------------
// Embedded file
// ---------------------------------------------------------------------------

function parseEmbeddedFile(id: string, space: ObjectSpace): EmbeddedFile {
  const props = propsOf(space, id);
  const node = parseEmbeddedFileNode(props);

  const filename = node.embeddedFileName ?? "";
  let data: Uint8Array = new Uint8Array(0);
  if (node.embeddedFileContainer) {
    const containerProps = propsOf(space, node.embeddedFileContainer);
    if (containerProps.fileData) {
      data = parseEmbeddedFileContainer(containerProps);
    }
  }

  return {
    filename,
    fileType: node.fileType,
    data,
    layoutMaxWidth: node.layoutMaxWidth,
    layoutMaxHeight: node.layoutMaxHeight,
    offsetHorizontal: node.offsetHorizontal,
    offsetVertical: node.offsetVertical,
    noteTags: parseNoteTags(node.noteTags, space)
  };
}

// ---------------------------------------------------------------------------
// Ink
// ---------------------------------------------------------------------------

const MAX_INK_NESTING_DEPTH = 16;

function parseInk(id: string, space: ObjectSpace): Ink {
  return parseInkRec(id, space, 0);
}

function parseInkRec(id: string, space: ObjectSpace, depth: number): Ink {
  if (depth > MAX_INK_NESTING_DEPTH) {
    throw new Error("maximum ink nesting depth exceeded");
  }

  const container = parseInkContainer(propsOf(space, id));

  if (!container.inkData) {
    const children = container.children ?? [];
    const content: InkContent = { type: "group", children: [] };
    let boundingBox: InkBoundingBox | undefined;
    for (const childId of children) {
      const child = parseInkRec(childId, space, depth + 1);
      if (child.boundingBox) {
        boundingBox = boundingBox
          ? unionBoundingBoxes(boundingBox, child.boundingBox)
          : child.boundingBox;
      }
      (content.children as Ink[]).push(child);
    }
    return {
      content,
      boundingBox,
      offsetHorizontal: container.offsetHorizontal,
      offsetVertical: container.offsetVertical
    };
  }

  const { strokes, boundingBox } = parseInkData(
    container.inkData,
    space,
    container.inkScalingX,
    container.inkScalingY
  );
  return {
    content: { type: "strokes", strokes },
    boundingBox,
    offsetHorizontal: container.offsetHorizontal,
    offsetVertical: container.offsetVertical
  };
}

function unionBoundingBoxes(a: InkBoundingBox, b: InkBoundingBox): InkBoundingBox {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const x2 = Math.max(a.x + a.width, b.x + b.width);
  const y2 = Math.max(a.y + a.height, b.y + b.height);
  return { x, y, width: x2 - x, height: y2 - y };
}

function parseInkData(
  inkDataId: string,
  space: ObjectSpace,
  scaleX?: number,
  scaleY?: number
): { strokes: InkStroke[]; boundingBox?: InkBoundingBox } {
  if (!space.getObject(inkDataId)) {
    return { strokes: [] };
  }
  const inkData = parseInkDataNode(propsOf(space, inkDataId));
  const strokes = inkData.strokes.map((strokeId) =>
    parseInkStroke(strokeId, space, scaleX, scaleY)
  );

  scaleX = scaleX ?? 1.0;
  scaleY = scaleY ?? 1.0;

  const boundingBox = inkData.boundingBox
    ? {
        x: inkData.boundingBox.xMin * scaleX,
        y: inkData.boundingBox.yMin * scaleY,
        width: (inkData.boundingBox.xMax - inkData.boundingBox.xMin) * scaleX,
        height: (inkData.boundingBox.yMax - inkData.boundingBox.yMin) * scaleY
      }
    : undefined;

  return { strokes, boundingBox };
}

function parseInkStroke(
  strokeId: string,
  space: ObjectSpace,
  scaleX?: number,
  scaleY?: number
): InkStroke {
  const data = parseInkStrokeNode(propsOf(space, strokeId));
  const props = parseStrokePropertiesNode(propsOf(space, data.properties));

  const idxX = props.dimensions.findIndex((d) => d.id === X_DIMENSION_GUID);
  const idxY = props.dimensions.findIndex((d) => d.id === Y_DIMENSION_GUID);
  if (idxX === -1) throw new Error("ink stroke properties has no x dimension");
  if (idxY === -1) throw new Error("ink stroke properties has no y dimension");

  const dimensionOffset =
    props.dimensions.length === 0 ? 0 : Math.floor(data.path.length / props.dimensions.length);

  const startX = dimensionOffset * idxX;
  const startY = dimensionOffset * idxY;

  const x = data.path.slice(startX, startX + dimensionOffset);
  const y = data.path.slice(startY, startY + dimensionOffset);

  scaleX = scaleX ?? 1.0;
  scaleY = scaleY ?? 1.0;

  const path: InkPoint[] = [];
  for (let i = 0; i < x.length; ++i) {
    path.push({ x: scaleX * x[i], y: scaleY * y[i] });
  }

  return {
    path,
    penTip: props.penTip,
    transparency: props.transparency,
    height: props.inkHeight,
    width: props.inkWidth,
    color: props.color
  };
}

// ---------------------------------------------------------------------------
// Ink recognition
// ---------------------------------------------------------------------------

function parseInkRecognition(id: string, space: ObjectSpace): InkRecognition | undefined {
  const lines: InkRecognizedLine[] = [];
  let wordId = 0;
  for (const lineId of parseRecognizedTextChildren(propsOf(space, id))) {
    const words: InkRecognizedWord[] = [];
    for (const blockId of parseRecognizedTextChildren(propsOf(space, lineId))) {
      for (const wordRefId of parseRecognizedTextChildren(propsOf(space, blockId))) {
        const word = parseRecognizedTextWord(propsOf(space, wordRefId));
        words.push({
          id: wordId++,
          alternatives: word.alternatives,
          languageId: word.languageId
        });
      }
    }
    if (words.length) lines.push({ words });
  }
  if (!lines.length) return undefined;
  return {
    lines,
    text: lines
      .map((line) =>
        line.words
          .map((word) => word.alternatives[0] ?? "")
          .filter((text) => text.length > 0)
          .join(" ")
      )
      .join("\n")
  };
}

// ---------------------------------------------------------------------------
// Page & section
// ---------------------------------------------------------------------------

function parseTitle(id: string, space: ObjectSpace): Title {
  const data = parseTitleNode(propsOf(space, id));
  return {
    contents: data.children.map((outlineId) => parseOutline(outlineId, space)),
    offsetHorizontal: data.offsetHorizontal,
    offsetVertical: data.offsetVertical,
    layoutAlignmentInParent: data.layoutAlignmentInParent,
    layoutAlignmentSelf: data.layoutAlignmentSelf
  };
}

function outlineText(outline: Outline): string | undefined {
  const element = outline.items[0];
  if (!element || element.type !== "element") return undefined;
  const richText = element.element.contents[0];
  if (!richText || richText.type !== "richText") return undefined;
  const visible = visibleText(richText.richText);
  return visible.length > 0 ? visible : undefined;
}

function visibleText(richText: RichText): string {
  const formatting = richText.textRunFormatting;
  if (formatting.length === 0) return richText.text;

  const utf16 = toUtf16Array(richText.text);
  const indices = richText.textRunIndices;

  const bounds: number[] = [0, ...indices];
  if (bounds.length === formatting.length) bounds.push(utf16.length);

  let output = "";
  for (let i = 0; i < formatting.length; ++i) {
    if (formatting[i].hidden) continue;
    const start = Math.min(bounds[i] ?? 0, utf16.length);
    const end = Math.min(bounds[i + 1] ?? utf16.length, utf16.length);
    if (start < end) {
      const chunk = utf16.slice(start, end);
      const CHUNK_SIZE = 0x8000;
      for (let i = 0; i < chunk.length; i += CHUNK_SIZE) {
        output += String.fromCharCode(...chunk.slice(i, i + CHUNK_SIZE));
      }
    }
  }
  return output;
}

function toUtf16Array(text: string): number[] {
  const result: number[] = [];
  for (let i = 0; i < text.length; ++i) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        const full = (code - 0xd800) * 0x400 + (next - 0xdc00) + 0x10000;
        result.push(0xd800 + Math.floor(full / 0x400), 0xdc00 + (full % 0x400));
        i += 1;
        continue;
      }
    }
    result.push(code);
  }
  return result;
}

function removeHyperlink(title: string): string {
  const HYPERLINK = "\ufddfHYPERLINK \"";
  let cleanTitle = title;
  while (true) {
    const markerStart = cleanTitle.indexOf(HYPERLINK);
    if (markerStart === -1) break;
    const hyperlinkPart = cleanTitle.slice(markerStart + HYPERLINK.length);
    const quoteEnd = hyperlinkPart.indexOf('"');
    if (quoteEnd !== -1) {
      cleanTitle =
        cleanTitle.slice(0, markerStart) +
        hyperlinkPart.slice(quoteEnd + 1);
    } else {
      cleanTitle = cleanTitle.slice(0, markerStart);
      break;
    }
  }
  return cleanTitle;
}

export function parsePage(pageSpaceId: string, store: {
  objectSpace(id: string): ObjectSpace | undefined;
}): Page {
  const space = store.objectSpace(pageSpaceId);
  if (!space) throw new Error(`page space ${pageSpaceId} is missing`);

  const metadata = parsePageMetadata(propsOf(space, space.metadataRoot() ?? ""));
  const manifest = parsePageManifest(propsOf(space, space.contentRoot() ?? ""));
  const pageProps = propsOf(space, manifest.page);
  const data = parsePageNode(pageProps);

  const title = data.title ? parseTitle(data.title, space) : undefined;
  const titleText = title
    ? outlineText(title.contents[0])
    : undefined;

  const inkRecognition = data.recognizedText
    ? parseInkRecognition(data.recognizedText, space)
    : undefined;

  const contents: PageContent[] = data.content.map((contentId) => {
    const object = getObject(space, contentId);
    switch (object.jcid.id) {
      case 0x00060011: // ImageNode
        return { type: "image", image: parseImage(contentId, space) };
      case 0x00060035: // EmbeddedFileNode
        return { type: "embeddedFile", embeddedFile: parseEmbeddedFile(contentId, space) };
      case 0x0006000c: // OutlineNode
        return { type: "outline", outline: parseOutline(contentId, space) };
      case 0x00060014: // InkContainer
        return { type: "ink", ink: parseInk(contentId, space) };
      default:
        return { type: "unknown" as const };
    }
  });

  return {
    linkTargetId: metadata.entityGuid,
    title,
    titleText: titleText
      ? removeHyperlink(titleText)
      : contents
          .filter((c): c is Extract<PageContent, { type: "outline" }> => c.type === "outline")
          .map((c) => outlineText(c.outline))
          .find((text) => text !== undefined),
    level: metadata.pageLevel,
    createdAt: metadata.createdAtMs,
    updatedAt: data.lastModifiedMs,
    author: data.author,
    height: data.pageHeight,
    contents,
    inkRecognition
  };
}

export function parseSection(
  store: { dataRoot: ObjectSpace; objectSpace(id: string): ObjectSpace | undefined },
  filename: string
): Section {
  const space = store.dataRoot;
  const metadata = parseSectionMetadata(propsOf(space, space.metadataRoot() ?? ""));
  const content = parseSectionNode(propsOf(space, space.contentRoot() ?? ""));

  const displayName =
    metadata.displayName ?? filename.replace(/\.one$/, "");

  return {
    displayName,
    pageSeries: content.pageSeries.map((pageSeriesId) =>
      parsePageSeries(pageSeriesId, store)
    ),
    color: metadata.color
  };
}

function parsePageSeries(id: string, store: {
  dataRoot: ObjectSpace;
  objectSpace(id: string): ObjectSpace | undefined;
}): PageSeries {
  const space = store.dataRoot;
  const data = parsePageSeriesNode(propsOf(space, id));
  return {
    pages: data.pageSpaces.map((pageSpaceId) => parsePage(pageSpaceId, store))
  };
}

// ---------------------------------------------------------------------------
// Notebook
// ---------------------------------------------------------------------------

export function parseNotebookToc(space: ObjectSpace): {
  entries: string[];
  color?: { alpha: number; r: number; g: number; b: number };
} {
  const contentRoot = space.contentRoot();
  if (!contentRoot) throw new Error("notebook has no content root");
  const entry = parseTocEntry(contentRoot, space);
  return {
    entries: orderedTocEntries(entry.entries),
    color: entry.color
  };
}

type TocEntry = {
  entries: { orderingId: number; name: string }[];
  color?: { alpha: number; r: number; g: number; b: number };
};

function parseTocEntry(id: string, space: ObjectSpace): TocEntry {
  const toc = parseTocContainer(propsOf(space, id));
  if (toc.filename !== undefined) {
    if (toc.orderingId === undefined)
      throw new Error("section has no order id");
    return {
      entries: [{ orderingId: toc.orderingId, name: toc.filename }],
      color: toc.color
    };
  }
  const entries = toc.children.map((childId) => parseTocEntry(childId, space));
  return {
    entries: entries.flatMap((entry) => entry.entries),
    color: toc.color
  };
}

function orderedTocEntries(entries: { orderingId: number; name: string }[]): string[] {
  // OneNote can retain older ordering snapshots in the same TOC. Later
  // references to a filename are authoritative.
  const seen = new Set<string>();
  const latest = entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => {
      if (seen.has(entry.name)) return false;
      seen.add(entry.name);
      return true;
    });
  latest.reverse();
  latest.sort((a, b) => a.entry.orderingId - b.entry.orderingId);
  return latest.map(({ entry }) => entry.name);
}

