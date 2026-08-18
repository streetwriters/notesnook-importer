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

import { BinaryReader } from "./reader";

export interface Span {
  type: number;
  start: number;
  end: number;
  expandFlag: number;
  color?: number;
  fontSize?: number;
  fontName?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  underlineType?: number;
  underlineColor?: number;
  backgroundColor?: number;
  strikethrough?: boolean;
  /** The link type of a hyperlink span. The link target is the text itself. */
  hyperlink?: number;
}

export interface Paragraph {
  type: number;
  start: number;
  end: number;
  direction?: number;
  indentLevel?: number;
  indentDirection?: number;
  alignment?: number;
  lineSpacingType?: number;
  lineSpacing?: number;
  bulletType?: number;
  bulletExtra?: number;
  parsingState?: number;
}

export interface ObjectSpan {
  objectType: number;
  data: Uint8Array;
}

export interface TextCommon {
  text: string;
  spans: Span[];
  paragraphs: Paragraph[];
  margins: [number, number, number, number];
  textGravity: number;
  objectRefs: [number, number][];
  objectSpanFlags: number;
  objectSpans: ObjectSpan[];
}

export const SpanTypes = {
  foregroundColor: 1,
  fontSize: 3,
  fontName: 4,
  bold: 5,
  italic: 6,
  underline: 7,
  hyperlink: 9,
  backgroundColor: 17,
  strikethrough: 20
};

export const ParagraphTypes = {
  direction: 1,
  indent: 2,
  alignment: 3,
  lineSpacing: 4,
  bullet: 5,
  parsingState: 6
};

export const Alignments = {
  left: 0,
  right: 1,
  center: 2,
  justify: 3
};

export const BulletTypes = {
  none: 0,
  arrow: 1,
  checker: 2,
  diamond: 3,
  digit: 4,
  circledDigit: 5,
  alphabet: 6,
  roman: 7,
  solidCircle: 8
};

export function parseTextCommon(
  reader: BinaryReader,
  formatVersion: number
): TextCommon {
  const textLength = reader.u32();
  if (textLength > 250000)
    throw new Error(`Invalid text length: ${textLength}`);

  const textBytes = reader.bytes(textLength * 2);
  const decodedText = textLength > 0 ? decodeUtf16(textBytes) : "";

  const spanCount = reader.u32();
  if (spanCount > 10000) throw new Error(`Invalid span count: ${spanCount}`);
  const spans: Span[] = [];
  for (let i = 0; i < spanCount; ++i) {
    const payloadSize = reader.u16();
    const start = reader.position;
    const span: Span = {
      type: reader.u32(),
      start: reader.u32(),
      end: reader.u32(),
      expandFlag: reader.u32()
    };
    if (span.type === SpanTypes.foregroundColor) span.color = reader.i32();
    else if (span.type === SpanTypes.backgroundColor)
      span.backgroundColor = reader.i32();
    else if (span.type === SpanTypes.fontSize) span.fontSize = reader.f32();
    else if (span.type === SpanTypes.fontName) {
      reader.skip(8);
      const nameLength = reader.u16();
      span.fontName =
        nameLength > 0 ? decodeUtf16(reader.bytes(nameLength * 2)) : "";
    } else if (span.type === SpanTypes.bold) span.bold = !!reader.u8();
    else if (span.type === SpanTypes.italic) span.italic = !!reader.u8();
    else if (span.type === SpanTypes.underline) {
      span.underline = !!reader.u8();
      span.underlineType = reader.u8();
      reader.skip(2);
      span.underlineColor = reader.i32();
    } else if (span.type === SpanTypes.strikethrough)
      span.strikethrough = !!reader.u8();
    else if (span.type === SpanTypes.hyperlink) span.hyperlink = reader.u32();

    spans.push(span);
    // A span's payload may contain extra unknown bytes: skip them.
    reader.seek(start + payloadSize);
  }

  const paragraphCount = reader.u32();
  if (paragraphCount > 10000)
    throw new Error(`Invalid paragraph count: ${paragraphCount}`);
  const paragraphs: Paragraph[] = [];
  for (let i = 0; i < paragraphCount; ++i) {
    const payloadSize = reader.u16();
    const start = reader.position;
    const paragraph: Paragraph = {
      type: reader.u32(),
      start: reader.u32(),
      end: reader.u32()
    };
    if (paragraph.type === ParagraphTypes.direction)
      paragraph.direction = reader.u32();
    else if (paragraph.type === ParagraphTypes.indent) {
      paragraph.indentLevel = reader.u32();
      paragraph.indentDirection = reader.u32();
    } else if (paragraph.type === ParagraphTypes.alignment)
      paragraph.alignment = reader.u32();
    else if (paragraph.type === ParagraphTypes.lineSpacing) {
      paragraph.lineSpacingType = reader.u8();
      reader.skip(3);
      paragraph.lineSpacing = reader.f32();
    } else if (paragraph.type === ParagraphTypes.bullet) {
      paragraph.bulletType = reader.u32();
      paragraph.bulletExtra = reader.u32();
    } else if (paragraph.type === ParagraphTypes.parsingState)
      paragraph.parsingState = reader.u32();

    paragraphs.push(paragraph);
    reader.seek(start + payloadSize);
  }

  const margins: [number, number, number, number] = [
    reader.f32(),
    reader.f32(),
    reader.f32(),
    reader.f32()
  ];
  const textGravity = reader.u8();
  const objectCount = reader.u16();
  const objectRefs: [number, number][] = [];
  for (let i = 0; i < objectCount; ++i)
    objectRefs.push([reader.u32(), reader.u32()]);

  let objectSpanFlags = 0;
  const objectSpans: ObjectSpan[] = [];
  if (formatVersion >= 2035) {
    objectSpanFlags = reader.u32();
    reader.skip(4);
    if (objectSpanFlags & 1) {
      const objectSpanCount = reader.u32();
      for (let i = 0; i < objectSpanCount; ++i) {
        const recordSize = reader.u32();
        const recordStart = reader.position;
        const binarySize = reader.u32();
        const objectType = reader.u32();
        objectSpans.push({
          objectType,
          data: reader.bytes(Math.min(binarySize, recordSize - 8))
        });
        reader.seek(recordStart + recordSize);
      }
    }
  }

  return {
    text: decodedText,
    spans,
    paragraphs,
    margins,
    textGravity,
    objectRefs,
    objectSpanFlags,
    objectSpans
  };
}

export function decodeUtf16(bytes: Uint8Array) {
  return new TextDecoder("utf-16le").decode(bytes);
}
