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

import { Message } from "protobufjs";
import { SqlDatabase, Attachment } from "@notesnook-importer/types";

export interface ANAccount {
  name: string;
  uuid: string;
  path: string;
}

export interface ANContext {
  database: SqlDatabase;
  noteIds: Record<string, string>;
  attachments: Attachment[];
  formatAttachment(attr: ANAttributeRun): Promise<string>;
  resolveAttachment(id: number, uti: string, hasFallback?: boolean): Promise<string | null>;
  decodeData<T extends ANConverter>(hexdata: string, converterType: ANConverterType<T>): T;
}

export abstract class ANConverter {
  ctx: ANContext;
  static protobufType: string;

  constructor(ctx: ANContext) {
    this.ctx = ctx;
  }

  abstract format(table?: boolean): Promise<string>;
}

export type ANConverterType<T extends ANConverter> = {
  new(ctx: ANContext, x: any): T;
  protobufType: string;
};

export type ANFragmentPair = {
  attr: ANAttributeRun;
  fragment: string;
};

export enum ANMultiRun {
  None,
  Monospaced,
  Alignment,
  List
}

export type ANTableUuidMapping = Record<string, number>;

export interface ANDocument extends Message {
  name: string;
  note: ANNote;
}

export interface ANNote extends Message {
  attributeRun: ANAttributeRun[];
  noteText: string;
  version: number;
}

export interface ANAttributeRun extends Message {
  [member: string]: any;

  length: number;
  paragraphStyle?: ANParagraphStyle;
  font?: ANFont;
  fontWeight?: ANFontWeight;
  underlined?: boolean;
  strikethrough?: number;
  superscript?: ANBaseline;
  link?: string;
  color?: ANColor;
  emphasisColor?: ANEmphasisColor;
  attachmentInfo?: ANAttachmentInfo;

  fragment: string;
  atLineStart: boolean;
}

export interface ANParagraphStyle extends Message {
  styleType?: ANStyleType;
  alignment?: ANAlignment;
  indentAmount?: number;
  checklist?: ANChecklist;
  blockquote?: number;
}

export enum ANStyleType {
  Default = -1,
  Title = 0,
  Heading = 1,
  Subheading = 2,
  Monospaced = 4,
  DottedList = 100,
  DashedList = 101,
  NumberedList = 102,
  Checkbox = 103
}

export enum ANAlignment {
  Left = 0,
  Centre = 1,
  Right = 2,
  Justify = 3
}

export interface ANChecklist extends Message {
  done: number;
  uuid: string;
}

export interface ANFont extends Message {
  fontName?: string;
  pointSize?: number;
  fontHints?: number;
}

export enum ANFontWeight {
  Regular = 0,
  Bold = 1,
  Italic = 2,
  BoldItalic = 3
}

export enum ANBaseline {
  Sub = -1,
  Default = 0,
  Super = 1
}

export interface ANColor extends Message {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

export enum ANEmphasisColor {
  Purple = 1,
  Pink = 2,
  Orange = 3,
  Mint = 4,
  Blue = 5
}

export enum ANFolderType {
  Default = 0,
  Trash = 1,
  Smart = 3
}

export interface ANAttachmentInfo extends Message {
  attachmentIdentifier: string;
  typeUti: string | ANAttachment;
}

export enum ANAttachment {
  Drawing = "com.apple.paper",
  DrawingLegacy = "com.apple.drawing",
  DrawingLegacy2 = "com.apple.drawing.2",
  Hashtag = "com.apple.notes.inlinetextattachment.hashtag",
  Mention = "com.apple.notes.inlinetextattachment.mention",
  InternalLink = "com.apple.notes.inlinetextattachment.link",
  ModifiedScan = "com.apple.paper.doc.scan",
  Scan = "com.apple.notes.gallery",
  Table = "com.apple.notes.table",
  UrlCard = "public.url"
}

export interface ANMergableDataProto extends Message {
  mergableDataObject: ANMergeableDataObject;
}

export interface ANMergeableDataObject extends Message {
  mergeableDataObjectData: ANDataStore;
}

export interface ANDataStore extends Message {
  mergeableDataObjectKeyItem: ANTableKey[];
  mergeableDataObjectTypeItem: ANTableType[];
  mergeableDataObjectUuidItem: Uint8Array[];
  mergeableDataObjectEntry: ANTableObject[];
}

export interface ANTableObject extends Message {
  customMap: any;
  dictionary: any;
  orderedSet: any;
  note: ANNote;
}

export enum ANTableKey {
  Identity = "identity",
  Direction = "crTableColumnDirection",
  Self = "self",
  Rows = "crRows",
  UUIDIndex = "UUIDIndex",
  Columns = "crColumns",
  CellColumns = "cellColumns"
}

export enum ANTableType {
  Number = "com.apple.CRDT.NSNumber",
  String = "com.apple.CRDT.NSString",
  Uuid = "com.apple.CRDT.NSUUID",
  Tuple = "com.apple.CRDT.CRTuple",
  MultiValueLeast = "com.apple.CRDT.CRRegisterMultiValueLeast",
  MultiValue = "com.apple.CRDT.CRRegisterMultiValue",
  Tree = "com.apple.CRDT.CRTree",
  Node = "com.apple.CRDT.CRTreeNode",
  Table = "com.apple.notes.CRTable",
  ICTable = "com.apple.notes.ICTable"
}
