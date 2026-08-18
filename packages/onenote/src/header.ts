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
  CBFormat,
  FileChunkReference,
  OneNoteReader,
  STPFormat,
} from "./reader";
import { GUID } from "./utils/guid";

const NUM_RESERVED_BYTES_AT_END_OF_HEADER = 728;
const PACKAGE_STORAGE_FILE_FORMAT_GUID = "638DE92FA6D44BC19A36B3FC2511A5B7";

export class OneNoteHeader {
  fileType: GUID;
  file: GUID;
  legacyFileVersion: GUID;
  fileFormat: GUID;

  lastCodeThatWroteToThisFile: number;
  oldestCodeThatHasWrittenToThisFile: number;
  newestCodeThatHasWrittenToThisFile: number;
  oldestCodeThatMayReadThisFile: number;

  legacyFreeChunkList: FileChunkReference;
  legacyTransactionLog: FileChunkReference;
  transactionsInLog: number;
  _expectedFileLength: number;
  placeholder: number;
  legacyFileNodeListRoot: FileChunkReference;

  legacyFreeSpaceInFreeChunkList: number;
  ignoredZeroA: string;
  ignoredZeroB: string;
  ignoredZeroC: string;
  ignoredZeroD: string;
  ancestor: GUID;
  name: number;

  hashedChunkList: FileChunkReference;
  transactionLog: FileChunkReference;
  fileNodeListRoot: FileChunkReference;
  freeChunkList: FileChunkReference;
  expectedFileLength: number;
  freeSpaceInFreeChunkList: number;
  fileVersion: GUID;
  fileVersionGeneration: number;
  denyReadFileVersion: GUID;
  debugLogFlags: number;
  debugLogA: FileChunkReference;
  debugLogB: FileChunkReference;
  buildNumberCreated: number;
  buildNumberLastWroteToFile: number;
  buildNumberOldestWritten: number;
  buildNumberNewestWritten: number;

  isLegacyOrAlternativePackaging: boolean;
  isMsOneStoreFormat: boolean;

  constructor(reader: OneNoteReader) {
    this.fileType = reader.deserializeGUID();
    this.file = reader.deserializeGUID();
    this.legacyFileVersion = reader.deserializeGUID();
    this.fileFormat = reader.deserializeGUID();

    this.lastCodeThatWroteToThisFile = reader.deserializeInt();
    this.oldestCodeThatHasWrittenToThisFile = reader.deserializeInt();
    this.newestCodeThatHasWrittenToThisFile = reader.deserializeInt();
    this.oldestCodeThatMayReadThisFile = reader.deserializeInt();

    this.legacyFreeChunkList = reader.deserializeFileChunkReference(
      STPFormat.UINT32,
      CBFormat.UINT32
    );
    this.legacyTransactionLog = reader.deserializeFileChunkReference(
      STPFormat.UINT32,
      CBFormat.UINT32
    );
    this.transactionsInLog = reader.deserializeInt();
    this._expectedFileLength = reader.deserializeInt();
    this.placeholder = reader.deserializeLong();
    this.legacyFileNodeListRoot = reader.deserializeFileChunkReference(
      STPFormat.UINT32,
      CBFormat.UINT32
    );

    this.legacyFreeSpaceInFreeChunkList = reader.deserializeInt();
    this.ignoredZeroA = reader.deserializeChar();
    this.ignoredZeroB = reader.deserializeChar();
    this.ignoredZeroC = reader.deserializeChar();
    this.ignoredZeroD = reader.deserializeChar();
    this.ancestor = reader.deserializeGUID();
    this.name = reader.deserializeInt();

    this.hashedChunkList = reader.deserializeFileChunkReference(
      STPFormat.ULONG64,
      CBFormat.UINT32
    );
    this.transactionLog = reader.deserializeFileChunkReference(
      STPFormat.ULONG64,
      CBFormat.UINT32
    );
    this.fileNodeListRoot = reader.deserializeFileChunkReference(
      STPFormat.ULONG64,
      CBFormat.UINT32
    );
    this.freeChunkList = reader.deserializeFileChunkReference(
      STPFormat.ULONG64,
      CBFormat.UINT32
    );
    this.expectedFileLength = reader.deserializeLong();
    this.freeSpaceInFreeChunkList = reader.deserializeLong();
    this.fileVersion = reader.deserializeGUID();
    this.fileVersionGeneration = reader.deserializeLong();
    this.denyReadFileVersion = reader.deserializeGUID();
    this.debugLogFlags = reader.deserializeInt();
    this.debugLogA = reader.deserializeFileChunkReference(
      STPFormat.ULONG64,
      CBFormat.UINT32
    );
    this.debugLogB = reader.deserializeFileChunkReference(
      STPFormat.ULONG64,
      CBFormat.UINT32
    );
    this.buildNumberCreated = reader.deserializeInt();
    this.buildNumberLastWroteToFile = reader.deserializeInt();
    this.buildNumberOldestWritten = reader.deserializeInt();
    this.buildNumberNewestWritten = reader.deserializeInt();

    this.isLegacyOrAlternativePackaging =
      this.fileFormat.toString() === PACKAGE_STORAGE_FILE_FORMAT_GUID;
    this.isMsOneStoreFormat =
      this.legacyFileVersion.toString() === GUID.nil().toString();

    reader.deserializeBytes(NUM_RESERVED_BYTES_AT_END_OF_HEADER);
  }
}
