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
import { parseTextCommon, TextCommon } from "./text-common";

export interface PenInfo {
  name: string | null;
  size: number;
  color: number;
  isCurvable: boolean;
  advancedSetting: string | null;
  isEraserEnabled: boolean;
  sizeLevel: number;
  particleDensity: number;
  particleSize?: number;
  isFixedWidth?: boolean;
  hsv: [number, number, number];
}

export interface StringId {
  id: number;
  value: string;
}

export interface AttachedFile {
  filename: string;
  bindId: number;
}

export interface VoiceRecording {
  bindId: number;
  name: string;
  duration: string;
  durationMs?: number;
  createdTime?: number;
  modifiedTime?: number;
}

export interface SamsungNote {
  formatVersion: number;
  minFormatVersion: number;
  noteId: string;
  fileRevision: number;
  createdTime: number;
  modifiedTime: number;
  width: number;
  height: number;
  pageHorizontalPadding: number;
  pageVerticalPadding: number;
  title: TextCommon;
  body: TextCommon;
  appName: string | null;
  appVersion: { major: number; minor: number; patch: string | null } | null;
  templateUri: string | null;
  lastEditedPageIndex: number | null;
  bodyTextFontSizeDelta: number | null;
  legacyPenInfo: PenInfo | null;
  currentPenInfo: PenInfo | null;
  stringIds: StringId[];
  attachedFiles: AttachedFile[];
  voiceRecordings: VoiceRecording[];
  fixedFont: string | null;
  fixedTextDirection: number | null;
  fixedBackgroundTheme: number | null;
}

const PropertyFlags = {
  appName: 0x000001,
  appVersion: 0x000002,
  authorInfo: 0x000004,
  geo: 0x000008,
  templateUri: 0x000040,
  lastEditedPageIndex: 0x000080,
  lastEditedPageImage: 0x000200,
  stringIdList: 0x000400,
  bodyTextFontSizeDelta: 0x000800,
  legacyPenInfo: 0x001000,
  voiceData: 0x002000,
  attachedFiles: 0x004000,
  currentPenInfo: 0x008000,
  lastRecognizedDataModifiedTime: 0x010000,
  fixedFont: 0x020000,
  fixedTextDirection: 0x040000,
  fixedBackgroundTheme: 0x080000,
  textSummarization: 0x100000,
  strokeGroupSize: 0x200000,
  appCustomData: 0x400000
};

export function parseNote(bytes: Uint8Array): SamsungNote {
  const reader = new BinaryReader(bytes);
  const integrityOffset = reader.u32();
  reader.skip(1);
  const headerFlags = reader.u32();
  reader.skip(1);
  const propertyFlags = reader.u32();

  const formatVersion = reader.u32();
  const noteId = reader.utf16() ?? "";
  const fileRevision = reader.u32();
  const createdTime = reader.u64() / 1000;
  const modifiedTime = reader.u64() / 1000;
  const width = reader.u32();
  const height = reader.u32();
  const pageHorizontalPadding = reader.u32();
  const pageVerticalPadding = reader.u32();
  const minFormatVersion = reader.u32();

  const titleObjectSize = reader.u32();
  const titleObject = reader.bytes(titleObjectSize);
  const bodyObjectSize = reader.u32();
  const bodyObject = reader.bytes(bodyObjectSize);

  const title = parseTextObject(titleObject, formatVersion);
  const body = parseTextObject(bodyObject, formatVersion);

  const note: SamsungNote = {
    formatVersion,
    minFormatVersion,
    noteId,
    fileRevision,
    createdTime,
    modifiedTime,
    width,
    height,
    pageHorizontalPadding,
    pageVerticalPadding,
    title,
    body,
    appName: null,
    appVersion: null,
    templateUri: null,
    lastEditedPageIndex: null,
    bodyTextFontSizeDelta: null,
    legacyPenInfo: null,
    currentPenInfo: null,
    stringIds: [],
    attachedFiles: [],
    voiceRecordings: [],
    fixedFont: null,
    fixedTextDirection: null,
    fixedBackgroundTheme: null
  };

  if (propertyFlags & PropertyFlags.appName) note.appName = reader.utf16();
  if (propertyFlags & PropertyFlags.appVersion)
    note.appVersion = {
      major: reader.i32(),
      minor: reader.i32(),
      patch: reader.utf16()
    };
  if (propertyFlags & PropertyFlags.authorInfo) {
    reader.utf16();
    reader.utf16();
    reader.utf16();
    reader.i32();
  }
  if (propertyFlags & PropertyFlags.geo) {
    reader.f64();
    reader.f64();
  }
  if (propertyFlags & PropertyFlags.templateUri)
    note.templateUri = reader.utf16();
  if (propertyFlags & PropertyFlags.lastEditedPageIndex)
    note.lastEditedPageIndex = reader.i32();
  if (propertyFlags & PropertyFlags.lastEditedPageImage) {
    reader.i32();
    reader.u64();
  }
  if (propertyFlags & PropertyFlags.stringIdList) {
    const blockSize = reader.u32();
    const end = reader.position + blockSize;
    const count = reader.u16();
    for (let i = 0; i < count; ++i) {
      const id = reader.i32();
      note.stringIds.push({ id, value: reader.utf16() ?? "" });
    }
    reader.seek(end);
  }
  if (propertyFlags & PropertyFlags.bodyTextFontSizeDelta)
    note.bodyTextFontSizeDelta = reader.i32();
  if (propertyFlags & PropertyFlags.legacyPenInfo)
    note.legacyPenInfo = parsePenInfo(reader, false);
  if (propertyFlags & PropertyFlags.voiceData) {
    const count = reader.u32();
    if (count <= 4096) {
      for (let i = 0; i < count; ++i)
        note.voiceRecordings.push(parseVoiceRecording(reader));
    }
  }
  if (propertyFlags & PropertyFlags.attachedFiles) {
    const count = reader.u16();
    for (let i = 0; i < count; ++i) {
      const filename = reader.utf16() ?? "";
      const bindId = reader.i32();
      note.attachedFiles.push({ filename, bindId });
    }
  }
  if (propertyFlags & PropertyFlags.currentPenInfo) {
    const blockSize = reader.u32();
    const end = reader.position + blockSize - 4;
    note.currentPenInfo = parsePenInfo(reader, true);
    reader.seek(end);
  }
  if (propertyFlags & PropertyFlags.lastRecognizedDataModifiedTime)
    reader.u64();
  if (propertyFlags & PropertyFlags.fixedFont) note.fixedFont = reader.utf16();
  if (propertyFlags & PropertyFlags.fixedTextDirection)
    note.fixedTextDirection = reader.i32();
  if (propertyFlags & PropertyFlags.fixedBackgroundTheme)
    note.fixedBackgroundTheme = reader.i32();
  if (propertyFlags & PropertyFlags.textSummarization) reader.utf16();
  if (propertyFlags & PropertyFlags.strokeGroupSize) reader.i32();
  if (propertyFlags & PropertyFlags.appCustomData) reader.utf16Long();

  // Skip any unknown optional bytes up to the integrity hash.
  if (integrityOffset > reader.position && integrityOffset <= bytes.byteLength)
    reader.seek(integrityOffset);

  return note;
}

/**
 * Parses a serialized text object: object-base record -> shape-base record ->
 * shape/text record -> TextCommon.
 */
export function parseTextObject(
  bytes: Uint8Array,
  formatVersion: number
): TextCommon {
  const empty: TextCommon = {
    text: "",
    spans: [],
    paragraphs: [],
    margins: [0, 0, 0, 0],
    textGravity: 0,
    objectRefs: [],
    objectSpanFlags: 0,
    objectSpans: []
  };

  const reader = new BinaryReader(bytes);
  const objectBaseSize = reader.u32();
  reader.seek(objectBaseSize);
  const shapeBaseSize = reader.u32();
  const shapeBaseStart = reader.position - 4;
  reader.seek(shapeBaseStart + shapeBaseSize);
  const shapeTextRecordOffset = reader.position;
  const shapeTextRecordSize = reader.u32();
  const recordType = reader.u16();
  const ownDataOffset = reader.u32();
  reader.skip(3);
  const propertyMask = reader.u32();

  if (
    recordType !== 7 ||
    !(propertyMask & 1) ||
    ownDataOffset + 4 > shapeTextRecordSize
  )
    return empty;

  const textCommonSizeOffset = shapeTextRecordOffset + ownDataOffset;
  reader.seek(textCommonSizeOffset);
  const textCommonSize = reader.u32();
  if (textCommonSize <= 0 || textCommonSize > bytes.byteLength) return empty;

  return parseTextCommon(
    new BinaryReader(reader.bytes(textCommonSize)),
    formatVersion
  );
}

export function parseVoiceRecording(reader: BinaryReader): VoiceRecording {
  const entrySize = reader.u32();
  const entryEnd = reader.position + entrySize;

  const recording: VoiceRecording = {
    bindId: reader.u32(),
    name: reader.utf16() ?? "",
    duration: reader.utf16() ?? "",
    durationMs: undefined,
    createdTime: undefined,
    modifiedTime: undefined
  };

  const remaining = () => entryEnd - reader.position;
  if (remaining() >= 16) reader.skip(16);
  if (remaining() >= 8) recording.createdTime = reader.u64() / 1000;
  if (remaining() >= 4) reader.skip(4);
  if (remaining() >= 8) recording.modifiedTime = reader.u64() / 1000;
  if (remaining() >= 4) recording.durationMs = reader.u32();

  reader.seek(entryEnd);
  return recording;
}

export function parsePenInfo(
  reader: BinaryReader,
  isCurrent: boolean
): PenInfo {
  const penInfo: PenInfo = {
    name: reader.utf16(),
    size: reader.f32(),
    color: reader.u32(),
    isCurvable: !!reader.i32(),
    advancedSetting: reader.utf16(),
    isEraserEnabled: !!reader.i32(),
    sizeLevel: reader.i32(),
    particleDensity: reader.i32(),
    particleSize: undefined,
    isFixedWidth: undefined,
    hsv: [0, 0, 0]
  };
  if (isCurrent) {
    penInfo.particleSize = reader.f32();
    penInfo.isFixedWidth = !!reader.i32();
  }
  penInfo.hsv = [reader.f32(), reader.f32(), reader.f32()];
  return penInfo;
}
