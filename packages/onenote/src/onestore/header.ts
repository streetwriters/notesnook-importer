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

import { OneNoteReader } from "../reader";
import {
  FileChunkReference32,
  FileChunkReference64x32,
} from "../utils/file-chunk-reference";
import { GUID } from "../utils/guid";
import {
  mustMatchGUID,
  mustBeZero,
  mustMatch,
  mustNotBeZero,
  mustBeFcrZero,
  mustBeFcrNil,
  mustNotBeFcrNil,
  mustNotBeFcrZero,
  property,
  mustHaveLength,
} from "../utils/validators";

const NUM_RESERVED_BYTES_AT_END_OF_HEADER = 728;

export enum OneStoreFileType {
  /**.one */
  STORE = "7B5C52E4-D88C-4DA7-AEB1-5378D02996D3",
  /** .onetoc2 */
  TABLE_OF_CONTENTS = "43FF2FA1-EFD9-4C76-9EE2-10EA5722765F",
}

export class OneStoreHeader {
  /**
   * A GUID, as specified by [MS-DTYP], that specifies the type of the revision store file. MUST be one of the values from the following:
   *
   * .one: `{7B5C52E4-D88C-4DA7-AEB1-5378D02996D3}`
   *
   * .onetoc2: `{43FF2FA1-EFD9-4C76-9EE2-10EA5722765F}`
   */
  private readonly guidFileType: GUID;

  /**
   * A GUID, as specified by [MS-DTYP], that specifies the identity of this revision store file. SHOULD be globally unique.
   */
  private readonly guidFile: GUID;

  /**
   * MUST be `{00000000-0000-0000-0000-000000000000}` and MUST be ignored.
   */
  private readonly guidLegacyFileVersion: GUID;

  /**
   * A GUID, as specified by [MS-DTYP], that specifies that the file is a revision store file. MUST be `{109ADD3F-911B-49F5-A5D0-1791EDC8AED8}`
   */
  private readonly guidFileFormat: GUID;

  /**
   * An unsigned integer. MUST be one of the values in the following, depending on the file type:
   *
   * .one: `0x0000002A`
   *
   * .onetoc2 `0x0000001B`
   */
  private readonly ffvLastCodeThatWroteToThisFile: number;

  /**
   * An unsigned integer. MUST be one of the values in the following, depending on the file type:
   *
   * .one: `0x0000002A`
   *
   * .onetoc2 `0x0000001B`
   */
  private readonly ffvOldestCodeThatHasWrittenToThisFile: number;

  /**
   * An unsigned integer. MUST be one of the values in the following, depending on the file type:
   *
   * .one: `0x0000002A`
   *
   * .onetoc2 `0x0000001B`
   */
  private readonly ffvNewestCodeThatHasWrittenToThisFile: number;

  /**
   * An unsigned integer. MUST be one of the values in the following, depending on the file type:
   *
   * .one: `0x0000002A`
   *
   * .onetoc2 `0x0000001B`
   */
  private readonly ffvOldestCodeThatMayReadThisFile: number;

  /**
   * A {@link FileChunkReference32} structure (section 2.2.4.1) that MUST have a value of "fcrZero" (see section 2.2.4).
   */
  private readonly fcrLegacyFreeChunkList: FileChunkReference32;

  /**
   *  A {@link FileChunkReference32} structure that MUST be "fcrNil" (see section 2.2.4).
   */
  private readonly fcrLegacyTransactionLog: FileChunkReference32;

  /**
   * An unsigned integer that specifies the number of transactions in the transaction log (section 2.3.3). MUST NOT be zero.
   */
  private readonly cTransactionsInLog: number;

  /**
   *  An unsigned integer that MUST be zero, and MUST be ignored.
   */
  private readonly _expectedFileLength: number;

  /**
   *  An unsigned integer that MUST be zero, and MUST be ignored.
   */
  private readonly rgbPlaceholder: number;

  /**
   * A {@link FileChunkReference32} structure that MUST be "fcrNil".
   */
  private readonly fcrLegacyFileNodeListRoot: FileChunkReference32;

  /**
   * An unsigned integer that MUST be zero, and MUST be ignored.
   */
  private readonly cbLegacyFreeSpaceInFreeChunkList: number;

  /**
   * MUST be ignored.
   */
  private readonly fNeedsDefrag: string;

  /**
   * MUST be ignored.
   */
  private readonly fRepairedFile: string;

  /**
   * MUST be ignored.
   */
  private readonly fNeedsGarbageCollect: string;

  /**
   * An unsigned integer that MUST be zero, and MUST be ignored.
   */
  private readonly fHasNoEmbeddedFileObjects: number;

  /**
   *  A GUID that specifies the Header.guidFile field of the table of contents file, as specified by [MS-ONE] section 2.1.15, given by the following table:
   *
   * **Section file (.one)**: Table of contents file is located in the same directory as this file.
   *
   * **Table of contents file (.onetoc2)**: Table of contents file is located in the parent directory of this file.
   *
   * If the GUID is `{00000000-0000-0000-0000-000000000000}`, this field does not reference a table of contents file.
   */
  private readonly guidAncestor: GUID;

  /**
   *  An unsigned integer that specifies the CRC value (section 2.1.2) of the name of this revision store file. The name is the Unicode representation of the file name with its extension and an additional null character at the end. This CRC is calculated using the CRC algorithm for the .one file (section 2.1.2), regardless of this revision store file format.
   */
  private readonly crcName: number;

  /**
   * A {@link FileChunkReference64x32} structure (section 2.2.4.4) that specifies a reference to the first FileNodeListFragment in a hashed chunk list (section 2.3.4). If the value of the {@link FileChunkReference64x32} structure is "fcrZero" or "fcrNil", the hashed chunk list does not exist.
   */
  readonly fcrHashedChunkList: FileChunkReference64x32;

  /**
   * A {@link FileChunkReference64x32} structure that specifies a reference to the first TransactionLogFragment structure (section 2.3.3.1) in a transaction log (section 2.3.3). The value of the fcrTransactionLog field MUST NOT be "fcrZero" and MUST NOT be "fcrNil".
   */
  readonly fcrTransactionLog: FileChunkReference64x32;

  /**
   * A {@link FileChunkReference64x32} structure that specifies a reference to a root file node list (section 2.1.14). The value of the fcrFileNodeListRoot field MUST NOT be "fcrZero" and MUST NOT be "fcrNil".
   */
  readonly fcrFileNodeListRoot: FileChunkReference64x32;

  /**
   * A {@link FileChunkReference64x32} structure that specifies a reference to the first FreeChunkListFragment structure (section 2.3.2.1). If the value of the {@link FileChunkReference64x32} structure is "fcrZero" or "fcrNil", then the free chunk list (section 2.3.2) does not exist.
   */
  readonly fcrFreeChunkList: FileChunkReference64x32;

  /**
   * An unsigned integer that specifies the size, in bytes, of this revision store file.
   */
  private readonly cbExpectedFileLength: number;

  /**
   * An unsigned integer that SHOULD* specify the size, in bytes, of the free space specified by the free chunk list.
   *
   * *Sometimes OneNote 2010 writes an incorrect sum of the total size of the free space in the Free Chunk List.
   */
  private readonly cbFreeSpaceInFreeChunkList: number;

  /**
   * A GUID, as specified by [MS-DTYP]. When either the value of cTransactionsInLog field or the guidDenyReadFileVersion field is being changed, guidFileVersion MUST be changed to a new GUID.
   */
  private readonly guidFileVersion: GUID;

  /**
   *  An unsigned integer that specifies the number of times the file has changed. MUST be incremented when the guidFileVersion field changes.
   */
  private readonly nFileVersionGeneration: number;

  /**
   * A GUID, as specified by [MS-DTYP]. When the existing contents of the file are being changed, excluding the {@link Header} structure of the file and unused storage blocks, guidDenyReadFileVersion MUST be changed to a new GUID.
   */
  private readonly guidDenyReadFileVersion: GUID;

  /**
   * MUST be zero. MUST be ignored.
   */
  private readonly grfDebugLogFlags: number;

  /**
   * A {@link FileChunkReference64x32} structure that MUST have a value "fcrZero". MUST be ignored.
   */
  private readonly fcrDebugLog: FileChunkReference64x32;

  /**
   * A {@link FileChunkReference64x32} structure that MUST be "fcrZero". MUST be ignored.
   */
  private readonly fcrAllocVerificationFreeChunkList: FileChunkReference64x32;

  /**
   *  An unsigned integer that specifies the build number of the application that created this revision store file. SHOULD* be ignored.
   *
   * *OneNote 2010 writes its own application build number.
   */
  private readonly bnCreated: number;

  /**
   * An unsigned integer that specifies the build number of the application that last wrote to this revision store file. SHOULD* be ignored.
   *
   * *OneNote 2010 writes its own application build number.
   */
  private readonly bnLastWroteToFile: number;

  /**
   * An unsigned integer that specifies the build number of the oldest application that wrote to this revision store file. SHOULD* be ignored.
   *
   * *OneNote 2010 writes its own application build number.
   */
  private readonly bnOldestWritten: number;

  /**
   * An unsigned integer that specifies the build number of the newest application that wrote to this revision store file. SHOULD* be ignored.
   *
   * *OneNote 2010 writes its own application build number.
   */
  private readonly bnNewestWritten: number;

  /**
   * MUST be zero. MUST be ignored.
   */
  private readonly rgbReserved: Uint8Array;

  fileType: OneStoreFileType;

  constructor(reader: OneNoteReader) {
    this.guidFileType = reader.deserializeGUID();
    this.guidFile = reader.deserializeGUID();
    this.guidLegacyFileVersion = reader.deserializeGUID();
    this.guidFileFormat = reader.deserializeGUID();

    this.ffvLastCodeThatWroteToThisFile = reader.deserializeInt();
    this.ffvOldestCodeThatHasWrittenToThisFile = reader.deserializeInt();
    this.ffvNewestCodeThatHasWrittenToThisFile = reader.deserializeInt();
    this.ffvOldestCodeThatMayReadThisFile = reader.deserializeInt();

    this.fcrLegacyFreeChunkList = reader.readFileChunkReference32();
    this.fcrLegacyTransactionLog = reader.readFileChunkReference32();
    this.cTransactionsInLog = reader.deserializeInt();
    this._expectedFileLength = reader.deserializeInt();
    this.rgbPlaceholder = reader.deserializeLong();
    this.fcrLegacyFileNodeListRoot = reader.readFileChunkReference32();

    this.cbLegacyFreeSpaceInFreeChunkList = reader.deserializeInt();
    this.fNeedsDefrag = reader.deserializeChar();
    this.fRepairedFile = reader.deserializeChar();
    this.fNeedsGarbageCollect = reader.deserializeChar();
    this.fHasNoEmbeddedFileObjects = reader.deserializeByte();
    this.guidAncestor = reader.deserializeGUID();
    this.crcName = reader.deserializeInt();

    this.fcrHashedChunkList = reader.readFileChunkReference64x32();
    this.fcrTransactionLog = reader.readFileChunkReference64x32();
    this.fcrFileNodeListRoot = reader.readFileChunkReference64x32();
    this.fcrFreeChunkList = reader.readFileChunkReference64x32();
    this.cbExpectedFileLength = reader.deserializeLong();
    this.cbFreeSpaceInFreeChunkList = reader.deserializeLong();
    this.guidFileVersion = reader.deserializeGUID();
    this.nFileVersionGeneration = reader.deserializeLong();
    this.guidDenyReadFileVersion = reader.deserializeGUID();
    this.grfDebugLogFlags = reader.deserializeInt();
    this.fcrDebugLog = reader.readFileChunkReference64x32();
    this.fcrAllocVerificationFreeChunkList =
      reader.readFileChunkReference64x32();
    this.bnCreated = reader.deserializeInt();
    this.bnLastWroteToFile = reader.deserializeInt();
    this.bnOldestWritten = reader.deserializeInt();
    this.bnNewestWritten = reader.deserializeInt();
    this.rgbReserved = reader.deserializeBytes(
      NUM_RESERVED_BYTES_AT_END_OF_HEADER
    );

    mustMatchGUID(
      GUID.parse("7B5C52E4-D88C-4DA7-AEB1-5378D02996D3"),
      GUID.parse("43FF2FA1-EFD9-4C76-9EE2-10EA5722765F")
    )(this, "guidFileType");
    mustMatchGUID(GUID.nil())(this, "guidLegacyFileVersion");
    mustMatchGUID(GUID.parse("109ADD3F-911B-49F5-A5D0-1791EDC8AED8"))(
      this,
      "guidFileFormat"
    );
    mustMatch(0x0000002a, 0x0000001b)(this, "ffvLastCodeThatWroteToThisFile");
    mustMatch(0x0000002a, 0x0000001b)(
      this,
      "ffvOldestCodeThatHasWrittenToThisFile"
    );
    mustMatch(0x0000002a, 0x0000001b)(
      this,
      "ffvNewestCodeThatHasWrittenToThisFile"
    );
    mustMatch(0x0000002a, 0x0000001b)(
      this,
      "ffvOldestCodeThatMayReadThisFile"
    );
    property(mustBeFcrZero)(this, "fcrLegacyFreeChunkList");
    property(mustBeFcrNil)(this, "fcrLegacyTransactionLog");
    mustNotBeZero(this, "cTransactionsInLog");
    mustBeZero(this, "_expectedFileLength");
    mustBeZero(this, "rgbPlaceholder");
    property(mustBeFcrNil)(this, "fcrLegacyFileNodeListRoot");
    mustBeZero(this, "cbLegacyFreeSpaceInFreeChunkList");
    mustBeZero(this, "fHasNoEmbeddedFileObjects");
    property(mustNotBeFcrNil, mustNotBeFcrZero)(this, "fcrTransactionLog");
    property(mustNotBeFcrNil, mustNotBeFcrZero)(this, "fcrFileNodeListRoot");
    mustBeZero(this, "grfDebugLogFlags");
    property(mustBeFcrZero)(this, "fcrDebugLog");
    property(mustBeFcrZero)(this, "fcrAllocVerificationFreeChunkList");
    mustHaveLength(NUM_RESERVED_BYTES_AT_END_OF_HEADER)(this, "rgbReserved");

    this.fileType = this.guidFileType.toString() as OneStoreFileType;
  }
}
