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
import { PenInfo, StringId } from "./note";
import { parseTextCommon, TextCommon } from "./text-common";

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Stroke {
  points: Point[];
  pressures: number[];
  timestamps: number[];
  color: number;
  penSize: number;
  penName?: string;
  advancedSetting?: string;
}

export interface ImageObject {
  bindId: number;
  rect: Rect;
  layoutType?: number;
  alpha?: number;
  cropRect?: Rect;
}

export interface TextFieldObject {
  rect: Rect;
  text: TextCommon;
}

export interface PdfBackground {
  fileId: number;
  pageIndex: number;
  rect: Rect;
}

export interface CanvasCacheEntry {
  fileId: number;
  width: number;
  height: number;
}

export interface PageObject {
  type: number;
  subrecordTypes: number[];
}

export interface PageLayer {
  number: number;
  flags1: number;
  flags2: number;
  objects: PageObject[];
}

export interface SamsungPage {
  id: string;
  width: number;
  height: number;
  orientation: number;
  modifiedTime: number;
  formatVersion: number;
  minFormatVersion: number;
  textOnly: boolean;
  propertyMask: number;
  drawnRect?: Rect;
  backgroundColor?: number;
  bgImageId?: number;
  bgImageMode?: number;
  bgWidth?: number;
  bgRotation?: number;
  templateType?: number;
  tags: string[];
  pdfBackgrounds: PdfBackground[];
  canvasCache: CanvasCacheEntry[];
  layers: PageLayer[];
  strokes: Stroke[];
  images: ImageObject[];
  textFields: TextFieldObject[];
}

export interface PageParseOptions {
  stringIds?: StringId[];
  penInfo?: PenInfo | null;
}

const COORD_DELTA_SCALE = 32.0;
const PRESSURE_DELTA_SCALE = 128.0;
const ANGLE_DELTA_SCALE = 32.0;

export function parsePage(
  bytes: Uint8Array,
  options: PageParseOptions = {}
): SamsungPage {
  const reader = new BinaryReader(bytes);
  const layerOffset = reader.u32();
  const propertyOffset = reader.u32();
  reader.skip(1);
  const textOnly = reader.u32() !== 0;
  reader.skip(1);
  const propertyMask = reader.u32();

  const orientation = reader.u32();
  const width = reader.u32();
  const height = reader.u32();
  reader.u32();
  reader.u32();
  const id = reader.utf16() ?? "";
  const modifiedTime = reader.u64() / 1000;
  const formatVersion = reader.u32();
  const minFormatVersion = reader.u32();

  const page: SamsungPage = {
    id,
    width,
    height,
    orientation,
    modifiedTime,
    formatVersion,
    minFormatVersion,
    textOnly,
    propertyMask,
    tags: [],
    pdfBackgrounds: [],
    canvasCache: [],
    layers: [],
    strokes: [],
    images: [],
    textFields: []
  };

  // Optional page-property block.
  let propertyEnd = propertyOffset;
  if (propertyOffset > 0 && propertyOffset < bytes.byteLength) {
    const propertyReader = reader.seek(propertyOffset);
    if (propertyMask & 0x1)
      page.drawnRect = {
        left: propertyReader.f64(),
        top: propertyReader.f64(),
        right: propertyReader.f64(),
        bottom: propertyReader.f64()
      };
    if (propertyMask & 0x2) {
      const count = propertyReader.u16();
      for (let i = 0; i < count; ++i)
        page.tags.push(propertyReader.utf16() ?? "");
    }
    if (propertyMask & 0x4) propertyReader.utf16();
    if (propertyMask & 0x8) page.bgImageId = propertyReader.u32();
    if (propertyMask & 0x10) page.bgImageMode = propertyReader.u32();
    if (propertyMask & 0x20) page.backgroundColor = propertyReader.u32();
    if (propertyMask & 0x40) page.bgWidth = propertyReader.u32();
    if (propertyMask & 0x80) page.bgRotation = propertyReader.u32();
    if (propertyMask & 0x100) {
      const count = propertyReader.u16();
      for (let i = 0; i < count; ++i) {
        const fileId = propertyReader.i32();
        const pageIndex = propertyReader.i32();
        const rect =
          formatVersion < 2034
            ? {
                left: propertyReader.f32(),
                top: propertyReader.f32(),
                right: propertyReader.f32(),
                bottom: propertyReader.f32()
              }
            : {
                left: propertyReader.i32(),
                top: propertyReader.i32(),
                right: propertyReader.i32(),
                bottom: propertyReader.i32()
              };
        page.pdfBackgrounds.push({ fileId, pageIndex, rect });
      }
    }
    if (propertyMask & 0x200) page.templateType = propertyReader.u32();
    if (propertyMask & 0x400) {
      const count = propertyReader.u32();
      const recordSize = propertyReader.u16();
      for (let i = 0; i < count; ++i) {
        const start = propertyReader.position;
        propertyReader.u32(); // key
        page.canvasCache.push({
          fileId: propertyReader.u32(),
          width: propertyReader.u32(),
          height: propertyReader.u32()
        });
        propertyReader.seek(start + recordSize);
      }
    }
    if (propertyMask & 0x800) propertyReader.u32();
    if (propertyMask & 0x1000) propertyReader.u32();
    if (propertyMask & 0x40000) {
      const count = propertyReader.u32();
      for (let i = 0; i < count; ++i) {
        propertyReader.u32();
        const size = propertyReader.u32();
        propertyReader.skip(size);
      }
    }
    propertyEnd = propertyReader.position;
  }

  // In the alternate trailer variant the first header field points to the
  // end-of-file trailer instead of the layer section; fall back to the end
  // of the page-property block.
  if (
    !parseLayers(bytes, layerOffset, page, options) &&
    layerOffset !== propertyEnd
  )
    parseLayers(bytes, propertyEnd, page, options);

  return page;
}

function parseLayers(
  bytes: Uint8Array,
  layerOffset: number,
  page: SamsungPage,
  options: PageParseOptions
): boolean {
  if (layerOffset < 0 || layerOffset + 4 > bytes.byteLength) return false;

  const reader = new BinaryReader(bytes).seek(layerOffset);
  const layerCount = reader.u16();
  if (layerCount <= 0 || layerCount > 64) return false;
  reader.u16(); // current layer index

  for (let i = 0; i < layerCount; ++i) {
    const layerStart = reader.position;
    const headerSize = reader.u32();
    if (headerSize < 16 || headerSize > 16384) return false;
    reader.u32(); // metadata offset
    reader.u8();
    const flags1 = reader.u8();
    reader.u8();
    const flags2 = reader.u8();
    const layerNumber = reader.u32();
    reader.seek(layerStart + headerSize);

    const objectCount = reader.u32();
    if (objectCount > 4096) return false;

    const objects: PageObject[] = [];
    for (let j = 0; j < objectCount; ++j) {
      const object = parseObject(bytes, reader, page, options);
      if (!object) return false;
      objects.push(object);
    }

    page.layers.push({
      number: layerNumber,
      flags1,
      flags2,
      objects
    });
  }

  return true;
}

function parseObject(
  bytes: Uint8Array,
  reader: BinaryReader,
  page: SamsungPage,
  options: PageParseOptions
): PageObject | null {
  const objectStart = reader.position;
  const type = reader.u8();
  const childCount = reader.u16();
  const objectSize = reader.u32();
  if (objectSize < 32 || objectStart + 7 + objectSize > bytes.byteLength)
    return null;

  const payloadStart = objectStart + 7;
  const payloadEnd = payloadStart + objectSize - 32;
  reader.seek(payloadEnd);
  reader.skip(32); // object hash

  const subrecords = parseSubrecords(bytes, payloadStart, payloadEnd);
  const object: PageObject = {
    type,
    subrecordTypes: subrecords.map((s) => s.type)
  };

  if (type === 1 || type === 15) {
    const stroke = parseStroke(bytes, subrecords, options);
    if (stroke) page.strokes.push(stroke);
  } else if (type === 3) {
    const image = parseImage(bytes, subrecords);
    if (image) page.images.push(image);
  } else if (type === 2) {
    const textField = parseTextField(bytes, subrecords, page.formatVersion);
    if (textField) page.textFields.push(textField);
  }

  for (let i = 0; i < childCount; ++i)
    parseObject(bytes, reader, page, options);

  return object;
}

interface Subrecord {
  type: number;
  start: number;
  end: number;
}

function parseSubrecords(
  bytes: Uint8Array,
  start: number,
  end: number
): Subrecord[] {
  const subrecords: Subrecord[] = [];
  let pos = start;
  while (pos + 6 <= end) {
    const size = new BinaryReader(bytes).seek(pos).u32();
    const type = new BinaryReader(bytes).seek(pos + 4).u16();
    if (size <= 0 || pos + size > end) break;
    subrecords.push({ type, start: pos, end: pos + size });
    pos += size;
  }
  return subrecords;
}

function parseStroke(
  bytes: Uint8Array,
  subrecords: Subrecord[],
  options: PageParseOptions
): Stroke | null {
  const subrecord = subrecords.find((s) => s.type === 1);
  if (!subrecord) return null;

  const reader = new BinaryReader(bytes).seek(subrecord.start + 6);
  const flexibleOffset = reader.u32();
  const mask1Length = reader.u8();
  const propertyMask1 = readVarUInt(bytes, reader.position, mask1Length);
  reader.seek(reader.position + mask1Length);
  const mask2Length = reader.u8();
  const flexibleMask = readVarUInt(bytes, reader.position, mask2Length);
  reader.seek(reader.position + mask2Length);
  const pointCount = reader.u16();

  const geometryLimit = subrecord.start + flexibleOffset;
  const geometry =
    propertyMask1 & 0x1
      ? parseCompactGeometry(
          bytes,
          reader.position,
          geometryLimit,
          pointCount,
          !!(propertyMask1 & 0x4)
        )
      : parseRawGeometry(
          bytes,
          reader.position,
          geometryLimit,
          pointCount,
          !!(propertyMask1 & 0x4)
        );
  if (!geometry) return null;

  const flexible = parseFlexibleBlock(
    bytes,
    geometryLimit,
    subrecord.end,
    flexibleMask
  );

  const stringIdMap = new Map(
    (options.stringIds ?? []).map((s) => [s.id, s.value])
  );

  let color = flexible.color;
  if (color === undefined) {
    if (flexible.penNameId !== undefined) {
      const name = stringIdMap.get(flexible.penNameId);
      if (name?.includes("Highlighter")) color = 0x7fffff00;
    }
    if (color === undefined && options.penInfo) color = options.penInfo.color;
    if (color === undefined) color = 0xff000000;
  }

  return {
    points: geometry.points,
    pressures: geometry.pressures,
    timestamps: geometry.timestamps,
    color,
    penSize: flexible.penSize ?? options.penInfo?.size ?? 2.0,
    penName:
      flexible.penNameId !== undefined
        ? stringIdMap.get(flexible.penNameId)
        : undefined,
    advancedSetting:
      flexible.advancedSettingId !== undefined
        ? stringIdMap.get(flexible.advancedSettingId)
        : undefined
  };
}

function readVarUInt(bytes: Uint8Array, offset: number, size: number): number {
  const reader = new BinaryReader(bytes).seek(offset);
  let value = 0;
  for (let i = 0; i < size; ++i) value |= reader.u8() << (i * 8);
  return value >>> 0;
}

interface StrokeGeometry {
  points: Point[];
  pressures: number[];
  timestamps: number[];
}

function unpackCoordDelta(value: number) {
  const sign = (value >> 15) & 1;
  const integer = (value >> 5) & 0x3ff;
  const fraction = value & 0x1f;
  const delta = integer + fraction / COORD_DELTA_SCALE;
  return sign ? -delta : delta;
}

function parseCompactGeometry(
  bytes: Uint8Array,
  start: number,
  limit: number,
  pointCount: number,
  hasOptionalAxes: boolean
): StrokeGeometry | null {
  const reader = new BinaryReader(bytes).seek(start);
  const deltaCount = Math.max(0, pointCount - 1);

  const points: Point[] = [];
  if (pointCount > 0) {
    if (reader.position + 16 > limit) return null;
    let x = reader.f64();
    let y = reader.f64();
    points.push({ x, y });
    for (let i = 0; i < deltaCount; ++i) {
      if (reader.position + 4 > limit) return null;
      x += unpackCoordDelta(reader.u16());
      y += unpackCoordDelta(reader.u16());
      points.push({ x, y });
    }
  }

  const pressures = parseCompactFloatSeries(
    reader,
    limit,
    pointCount,
    PRESSURE_DELTA_SCALE
  );
  if (!pressures) return null;

  const timestamps = parseCompactTimestampSeries(reader, limit, pointCount);
  if (!timestamps) return null;

  if (hasOptionalAxes) {
    if (!parseCompactFloatSeries(reader, limit, pointCount, ANGLE_DELTA_SCALE))
      return null;
    if (!parseCompactFloatSeries(reader, limit, pointCount, ANGLE_DELTA_SCALE))
      return null;
  }

  return { points, pressures, timestamps };
}

function parseRawGeometry(
  bytes: Uint8Array,
  start: number,
  limit: number,
  pointCount: number,
  hasOptionalAxes: boolean
): StrokeGeometry | null {
  const axisBytes = pointCount * 4 * (hasOptionalAxes ? 2 : 0);
  const rawF32Size = pointCount * 16 + axisBytes + 2;
  const rawF64Size = pointCount * 24 + axisBytes + 2;
  const available = limit - start;

  let pointSize: number;
  if (available === rawF32Size) pointSize = 4;
  else if (available === rawF64Size) pointSize = 8;
  else return null;

  const reader = new BinaryReader(bytes).seek(start);
  const points: Point[] = [];
  for (let i = 0; i < pointCount; ++i) {
    const x = pointSize === 4 ? reader.f32() : reader.f64();
    const y = pointSize === 4 ? reader.f32() : reader.f64();
    points.push({ x, y });
  }
  const pressures: number[] = [];
  for (let i = 0; i < pointCount; ++i) pressures.push(reader.f32());
  const timestamps: number[] = [];
  for (let i = 0; i < pointCount; ++i) timestamps.push(reader.i32());
  if (hasOptionalAxes) {
    for (let i = 0; i < pointCount; ++i) reader.f32();
    for (let i = 0; i < pointCount; ++i) reader.f32();
  }

  return { points, pressures, timestamps };
}

function parseCompactFloatSeries(
  reader: BinaryReader,
  limit: number,
  pointCount: number,
  deltaScale: number
): number[] | null {
  if (pointCount <= 0) return [];
  const size = 4 + Math.max(0, pointCount - 1) * 2;
  if (reader.position + size > limit) return null;

  const values = [reader.f32()];
  for (let i = 0; i < pointCount - 1; ++i)
    values.push(
      values[values.length - 1] + unpackCoordDelta(reader.u16()) / deltaScale
    );
  return values;
}

function parseCompactTimestampSeries(
  reader: BinaryReader,
  limit: number,
  pointCount: number
): number[] | null {
  if (pointCount <= 0) return [];
  const size = 4 + Math.max(0, pointCount - 1) * 2;
  if (reader.position + size > limit) return null;

  const values = [reader.i32()];
  for (let i = 0; i < pointCount - 1; ++i)
    values.push(values[values.length - 1] + reader.u16());
  return values;
}

interface FlexibleData {
  advancedSettingId?: number;
  color?: number;
  penSize?: number;
  penNameId?: number;
}

function parseFlexibleBlock(
  bytes: Uint8Array,
  start: number,
  end: number,
  mask: number
): FlexibleData {
  const reader = new BinaryReader(bytes).seek(start);
  const info: FlexibleData = {};

  const readU32 = () => (reader.position + 4 <= end ? reader.u32() : null);
  const readF32 = () => (reader.position + 4 <= end ? reader.f32() : null);
  const readU16 = () => (reader.position + 2 <= end ? reader.u16() : null);
  const readU8 = () => (reader.position + 1 <= end ? reader.u8() : null);

  if (mask & 0x0002) info.advancedSettingId = readU32() ?? undefined;
  if (mask & 0x0004) info.color = readU32() ?? undefined;
  if (mask & 0x0008) info.penSize = readF32() ?? undefined;
  if (mask & 0x0010) readU8();
  if (mask & 0x0020) return info;
  if (mask & 0x0080) info.penNameId = readU32() ?? undefined;
  if (mask & 0x0100) readF32();
  if (mask & 0x0200) readU32();
  if (mask & 0x0400) readU32();
  if (mask & 0x0800) readU32();
  if (mask & 0x1000) readU32();
  if (mask & 0x2000) readF32();
  if (mask & 0x4000) readU16();
  if (mask & 0x8000) readF32();
  if (mask & 0x10000) readU16();
  if (mask & 0x20000) readF32();

  return info;
}

function parseImage(
  bytes: Uint8Array,
  subrecords: Subrecord[]
): ImageObject | null {
  const shape = subrecords.find((s) => s.type === 7);
  if (!shape || shape.start + 53 > shape.end) return null;

  const reader = new BinaryReader(bytes).seek(shape.start + 6);
  const ownOffset = reader.u32();
  reader.skip(3);
  const propertyMask = reader.u32();
  reader.u32(); // shape type
  const rect = {
    left: reader.f64(),
    top: reader.f64(),
    right: reader.f64(),
    bottom: reader.f64()
  };

  if (ownOffset <= 0 || !(propertyMask & 0x20)) return null;

  let cursor = shape.start + ownOffset;
  if (propertyMask & 0x1) return null;
  if (propertyMask & 0x2) cursor += 1;
  if (propertyMask & 0x4) cursor += 4;
  if (propertyMask & 0x8) cursor += 4;
  if (propertyMask & 0x10) cursor += 4;

  const fillReader = new BinaryReader(bytes).seek(cursor);
  const blockSize = fillReader.u32();
  const effectType = fillReader.u8();
  if (blockSize < 6 || effectType !== 2) return null;
  fillReader.u8(); // image type
  const bindId = fillReader.u32();

  const image: ImageObject = { bindId, rect };

  const layout = subrecords.find((s) => s.type === 6);
  if (layout && layout.start + 10 <= layout.end) {
    const layoutReader = new BinaryReader(bytes).seek(layout.start + 6);
    const layoutOwnOffset = layoutReader.u32();
    const ownStart = layout.start + layoutOwnOffset;
    if (ownStart + 14 <= layout.end) {
      const ownReader = new BinaryReader(bytes).seek(ownStart);
      ownReader.u32(); // block size
      ownReader.skip(2);
      image.layoutType = ownReader.u32();
      image.alpha = ownReader.u32();
    }
  }

  const imageOwn = subrecords.find((s) => s.type === 3);
  if (imageOwn && imageOwn.end - imageOwn.start > 6 + 10) {
    const ownReader = new BinaryReader(bytes).seek(imageOwn.start + 6);
    ownReader.u8(); // flexible payload present
    ownReader.skip(6);
    const group1Flags = ownReader.u8();
    ownReader.u8(); // group2
    ownReader.u8(); // group3
    ownReader.u8();
    if (group1Flags & 0x2) {
      image.cropRect = {
        left: ownReader.i32(),
        top: ownReader.i32(),
        right: ownReader.i32(),
        bottom: ownReader.i32()
      };
    }
  }

  return image;
}

function parseTextField(
  bytes: Uint8Array,
  subrecords: Subrecord[],
  formatVersion: number
): TextFieldObject | null {
  const shape = subrecords.find((s) => s.type === 7);
  if (!shape || shape.start + 53 > shape.end) return null;

  const reader = new BinaryReader(bytes).seek(shape.start + 6);
  const ownOffset = reader.u32();
  reader.skip(3);
  const propertyMask = reader.u32();
  const shapeType = reader.u32();
  const rect = {
    left: reader.f64(),
    top: reader.f64(),
    right: reader.f64(),
    bottom: reader.f64()
  };

  if (shapeType !== 4 || !(propertyMask & 0x1)) return null;
  if (ownOffset <= 0 || shape.start + ownOffset + 4 > shape.end) return null;

  const sizeReader = new BinaryReader(bytes).seek(shape.start + ownOffset);
  const textCommonSize = sizeReader.u32();
  if (textCommonSize <= 0 || textCommonSize > shape.end - sizeReader.position)
    return null;

  const text = parseTextCommon(
    new BinaryReader(sizeReader.bytes(textCommonSize)),
    formatVersion
  );

  return { rect, text };
}
