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

import { OneNoteReader } from "./reader";
import { FileChunkReference64x32 } from "./utils/file-chunk-reference";
import { toBase64 } from "./utils/base64";
import { decode, toHex } from "./utils/reader";

export class FileNodeList {
  readonly end: number;
  readonly fragments: FileNodeListFragment[];
  constructor(
    reader: OneNoteReader,
    fileChunkReference: FileChunkReference64x32
  ) {
    if (reader.position !== Number(fileChunkReference.stp))
      reader.seek(Number(fileChunkReference.stp));
    this.end = Number(fileChunkReference.stp) + Number(fileChunkReference.cb);
    this.fragments = [];

    let ref = fileChunkReference;
    while (true) {
      const sectionEnd = Number(ref.stp) + Number(ref.cb);
      const fragment = new FileNodeListFragment(reader, sectionEnd);
      this.fragments.push(fragment);

      if (fragment.nextFragment.isNil) break;
      ref = fragment.nextFragment;

      reader.seek(Number(fragment.nextFragment.stp));
    }
  }
}

class FileNodeListFragment {
  // readonly fileNodes: FileNode[];
  readonly fileNodeListHeader: FileNodeListHeader;
  readonly nextFragment: FileChunkReference64x32;
  readonly footer: number;
  constructor(reader: OneNoteReader, end: number) {
    // this.fileNodes = [];
    this.fileNodeListHeader = new FileNodeListHeader(reader);

    // while (reader.position + 24 < end) {
    //   const fileNode = new FileNode(reader);
    //   this.fileNodes.push(fileNode);
    //   if (fileNode.header.id == 255 || fileNode.header.id == 0) break;
    // }

    reader.seek(end - 20);

    this.nextFragment = reader.readFileChunkReference64x32();
    this.footer = reader.deserializeLong();
  }
}

class FileNodeListHeader {
  readonly uintMagic: string;
  readonly fileNodeListId: number;
  readonly nFragmentSequence: number;
  constructor(reader: OneNoteReader) {
    this.uintMagic = toHex(reader.deserializeBytes(8));
    this.fileNodeListId = reader.deserializeInt();
    this.nFragmentSequence = reader.deserializeInt();
  }
}

// class FileNode {
//   static count: number = 0;
//   readonly header: FileNodeHeader;
//   readonly children: any[];
//   readonly data: any | null = null;
//   readonly propertySet: ObjectPropSet | null = null;

//   constructor(reader: OneNoteReader) {
//     this.header = new FileNodeHeader(reader);
//     this.children = [];

//     FileNode.count += 1;
//     const fnd = FileNodeData[this.header.type];
//     if (typeof fnd !== "boolean" && !!fnd) {
//       if (this.header.type === "ObjectDeclaration2RefCountFND") {
//         const fnd = FileNodeData[this.header.type];
//         this.data = fnd(reader, this.header);

//         const offset = reader.position;
//         if (this.data.body.jcid.isPropertySet) {
//           reader.seek(Number(this.data.ref.stp));
//           this.propertySet = ObjectSpaceObjectPropSet(reader);
//           reader.seek(offset);
//         }
//       } else {
//         this.data = fnd(reader, this.header);
//       }
//     }

//     const currentOffset = reader.position;
//     if (this.header.baseType === 2 && this.data?.ref) {
//       this.children.push(new FileNodeList(reader, this.data.ref));
//     }
//     reader.seek(currentOffset);
//   }
// }

function objectDeclaration2Body(reader: OneNoteReader) {
  const oid = reader.deserializeCompactId();
  const jcid = reader.deserializeJCID();
  const data = reader.deserializeByte();
  return {
    oid,
    jcid,
    data,
    fHasOidReferences: (data & 0x1) !== 0,
    fHasOsidReferences: (data & 0x2) !== 0,
  };
}

function objectInfoDependencyOverrideData(reader: OneNoteReader) {
  const result = {
    c8BitOverrides: reader.deserializeInt(),
    c32BitOverrides: reader.deserializeInt(),
    crc: reader.deserializeInt(),
    overrides1: [] as any[],
  };
  for (let i = 0; i < result.c8BitOverrides; ++i)
    result.overrides1.push(objectInfoDependencyOverride8(reader));
  for (let i = 0; i < result.c32BitOverrides; ++i)
    result.overrides1.push(objectInfoDependencyOverride32(reader));
  return result;
}

function objectInfoDependencyOverride8(reader: OneNoteReader) {
  return { oid: reader.deserializeCompactId(), cRef: reader.deserializeByte() };
}
function objectInfoDependencyOverride32(reader: OneNoteReader) {
  return { oid: reader.deserializeCompactId(), cRef: reader.deserializeInt() };
}

function FileDataStoreObject(
  reader: OneNoteReader,
  fileNodeChunkReference: FileChunkReference64x32
) {
  const guidHeader = reader.deserializeGUID();
  const cbLength = reader.deserializeLong();
  const unused = reader.deserializeBytes(4);
  const reserved = reader.deserializeBytes(8);

  const fileData = toBase64(reader.deserializeBytes(Number(cbLength)));
  reader.seek(
    Number(fileNodeChunkReference.stp) + Number(fileNodeChunkReference.cb) - 16
  );
  const guidFooter = reader.deserializeGUID();
  return { guidHeader, cbLength, fileData, guidFooter };
}

function StringInStorageBuffer(reader: OneNoteReader) {
  const cch = reader.deserializeInt();
  const lengthInBytes = cch * 2;
  const data = reader.deserializeBytes(lengthInBytes);
  return decode(data, "utf16le");
}

// const FileNodeData = {
//   RevisionManifestEndFND: false,
//   RevisionManifestStart6FND: (reader: OneNoteReader) => ({
//     rid: reader.deserializeExtendedGUID(),
//     ridDependent: reader.deserializeExtendedGUID(),
//     revisionRole: reader.deserializeInt(),
//     odcsDefault: reader.deserializeShort(),
//   }),
//   RevisionManifestStart7FND: (reader: OneNoteReader) => ({
//     base: FileNodeData.RevisionManifestStart6FND(reader),
//     gctxid: reader.deserializeExtendedGUID(),
//   }),
//   GlobalIdTableStartFNDX: false,
//   GlobalIdTableStart2FND: false,
//   GlobalIdTableEntryFNDX: (reader: OneNoteReader) => ({
//     index: reader.deserializeInt(),
//     guid: reader.deserializeGUID(),
//   }),
//   GlobalIdTableEntry2FNDX: false,
//   GlobalIdTableEntry3FNDX: false,
//   GlobalIdTableEndFNDX: false,
//   ObjectDeclarationWithRefCountFNDX: false,
//   ObjectDeclarationWithRefCount2FNDX: false,
//   ObjectRevisionWithRefCountFNDX: false,
//   ObjectRevisionWithRefCount2FNDX: false,
//   RootObjectReference2FNDX: (reader: OneNoteReader) => ({
//     oidRoot: reader.deserializeCompactId(),
//     rootRole: reader.deserializeInt(),
//   }),
//   RootObjectReference3FND: (reader: OneNoteReader) => ({
//     oidRoot: reader.deserializeExtendedGUID(),
//     rootRole: reader.deserializeInt(),
//   }),
//   RevisionRoleDeclarationFND: (reader: OneNoteReader) => ({
//     rid: reader.deserializeExtendedGUID(),
//     revisionRole: reader.deserializeInt(),
//   }),
//   RevisionRoleAndContextDeclarationFND: (reader: OneNoteReader) => ({
//     base: FileNodeData.RevisionRoleDeclarationFND(reader),
//     gctxid: reader.deserializeExtendedGUID(),
//   }),
//   ObjectDeclarationFileData3RefCountFND: (reader: OneNoteReader) => ({
//     oid: reader.deserializeCompactId(),
//     jcid: reader.deserializeJCID(),
//     cRef: reader.deserializeByte(),
//     fileDataReference: StringInStorageBuffer(reader),
//     extension: StringInStorageBuffer(reader),
//   }),
//   ObjectDeclarationFileData3LargeRefCountFND: false,
//   ObjectDataEncryptionKeyV2FNDX: false,
//   ObjectInfoDependencyOverridesFND: (
//     reader: OneNoteReader,
//     header: FileNodeHeader
//   ) => {
//     const ref = reader.deserializeFileChunkReference(
//       header.stpFormat,
//       header.cbFormat
//     );
//     if (ref.isNil) objectInfoDependencyOverrideData(reader);
//     return {
//       ref,
//     };
//   },
//   DataSignatureGroupDefinitionFND: (reader: OneNoteReader) => ({
//     dataSignatureGroup: reader.deserializeExtendedGUID(),
//   }),
//   FileDataStoreListReferenceFND: (
//     reader: OneNoteReader,
//     header: FileNodeHeader
//   ) => ({
//     ref: reader.deserializeFileChunkReference(
//       header.stpFormat,
//       header.cbFormat
//     ),
//   }),
//   FileDataStoreObjectReferenceFND: (
//     reader: OneNoteReader,
//     header: FileNodeHeader
//   ) => {
//     const ref = reader.deserializeFileChunkReference(
//       header.stpFormat,
//       header.cbFormat
//     );
//     const guidReference = reader.deserializeGUID();

//     const currentOffset = reader.position;
//     reader.seek(Number(ref.stp));
//     const fileDataStoreObject = FileDataStoreObject(reader, ref);
//     reader.seek(currentOffset);

//     return { ref, guidReference, fileDataStoreObject };
//   },
//   ObjectDeclaration2RefCountFND: (
//     reader: OneNoteReader,
//     header: FileNodeHeader
//   ) => ({
//     ref: reader.deserializeFileChunkReference(
//       header.stpFormat,
//       header.cbFormat
//     ),
//     body: objectDeclaration2Body(reader),
//     cRef: reader.deserializeByte(),
//   }),
//   ObjectDeclaration2LargeRefCountFND: (
//     reader: OneNoteReader,
//     header: FileNodeHeader
//   ) => ({
//     ref: reader.deserializeFileChunkReference(
//       header.stpFormat,
//       header.cbFormat
//     ),
//     body: objectDeclaration2Body(reader),
//     cRef: reader.deserializeInt(),
//   }),
//   ObjectGroupListReferenceFND: (
//     reader: OneNoteReader,
//     header: FileNodeHeader
//   ) => ({
//     ref: reader.deserializeFileChunkReference(
//       header.stpFormat,
//       header.cbFormat
//     ),
//     objectGroupId: reader.deserializeExtendedGUID(),
//   }),
//   ObjectGroupStartFND: (reader: OneNoteReader) => ({
//     oid: reader.deserializeExtendedGUID(),
//   }),
//   ObjectGroupEndFND: (reader: OneNoteReader) => ({
//     gosid: reader.deserializeExtendedGUID(),
//   }),
//   HashedChunkDescriptor2FND: false,
//   ReadOnlyObjectDeclaration2RefCountFND: (
//     reader: OneNoteReader,
//     header: FileNodeHeader
//   ) => ({
//     base: FileNodeData.ObjectDeclaration2RefCountFND(reader, header),
//     md5Hash: reader.deserializeBytes(16).toString("hex"),
//   }),
//   ReadOnlyObjectDeclaration2LargeRefCountFND: (
//     reader: OneNoteReader,
//     header: FileNodeHeader
//   ) => ({
//     base: FileNodeData.ObjectDeclaration2LargeRefCountFND(reader, header),
//     md5Hash: reader.deserializeBytes(16).toString("hex"),
//   }),
//   ChunkTerminatorFND: false,
//   UnknownFND: () => false,
// };
// type FileNodeType = keyof typeof FileNodeData;

// const FileNodeIDs: Record<number, [number, number, FileNodeType]> = {
//   0x004: [0x004, 0, "ObjectSpaceManifestRootFND"],
//   0x008: [0x008, 2, "ObjectSpaceManifestListReferenceFND"],
//   0x00c: [0x00c, 0, "ObjectSpaceManifestListStartFND"],
//   0x010: [0x010, 2, "RevisionManifestListReferenceFND"],
//   0x014: [0x014, 0, "RevisionManifestListStartFND"],
//   0x01b: [0x01b, 0, "RevisionManifestStart4FND"],
//   0x01c: [0x01c, 0, "RevisionManifestEndFND"],
//   0x01e: [0x01e, 0, "RevisionManifestStart6FND"],
//   0x01f: [0x01f, 0, "RevisionManifestStart7FND"],
//   0x021: [0x021, 0, "GlobalIdTableStartFNDX"],
//   0x022: [0x022, 0, "GlobalIdTableStart2FND"],
//   0x024: [0x024, 0, "GlobalIdTableEntryFNDX"],
//   0x025: [0x025, 0, "GlobalIdTableEntry2FNDX"],
//   0x026: [0x026, 0, "GlobalIdTableEntry3FNDX"],
//   0x028: [0x028, 0, "GlobalIdTableEndFNDX"],
//   0x02d: [0x02d, 1, "ObjectDeclarationWithRefCountFNDX"],
//   0x02e: [0x02e, 1, "ObjectDeclarationWithRefCount2FNDX"],
//   0x041: [0x041, 1, "ObjectRevisionWithRefCountFNDX"],
//   0x042: [0x042, 1, "ObjectRevisionWithRefCount2FNDX"],
//   0x059: [0x059, 0, "RootObjectReference2FNDX"],
//   0x05a: [0x05a, 0, "RootObjectReference3FND"],
//   0x05c: [0x05c, 0, "RevisionRoleDeclarationFND"],
//   0x05d: [0x05d, 0, "RevisionRoleAndContextDeclarationFND"],
//   0x072: [0x072, 0, "ObjectDeclarationFileData3RefCountFND"],
//   0x073: [0x073, 0, "ObjectDeclarationFileData3LargeRefCountFND"],
//   0x07c: [0x07c, 1, "ObjectDataEncryptionKeyV2FNDX"],
//   0x084: [0x084, 1, "ObjectInfoDependencyOverridesFND"],
//   0x08c: [0x08c, 0, "DataSignatureGroupDefinitionFND"],
//   0x090: [0x090, 2, "FileDataStoreListReferenceFND"],
//   0x094: [0x094, 1, "FileDataStoreObjectReferenceFND"],
//   0x0a4: [0x0a4, 1, "ObjectDeclaration2RefCountFND"],
//   0x0a5: [0x0a5, 1, "ObjectDeclaration2LargeRefCountFND"],
//   0x0b0: [0x0b0, 2, "ObjectGroupListReferenceFND"],
//   0x0b4: [0x0b4, 0, "ObjectGroupStartFND"],
//   0x0b8: [0x0b8, 0, "ObjectGroupEndFND"],
//   0x0c2: [0x0c2, 1, "HashedChunkDescriptor2FND"],
//   0x0c4: [0x0c4, 1, "ReadOnlyObjectDeclaration2RefCountFND"],
//   0x0c5: [0x0c5, 1, "ReadOnlyObjectDeclaration2LargeRefCountFND"],
//   0x0ff: [0x0ff, -1, "ChunkTerminatorFND"],
// };

// class FileNodeHeader {
//   readonly header: number;
//   readonly id: number;
//   readonly type: FileNodeType;

//   readonly size: number;
//   readonly stpFormat: STPFormat;
//   readonly cbFormat: CBFormat;
//   readonly baseType: number;
//   readonly reserved: number;
//   constructor(reader: OneNoteReader) {
//     this.header = reader.deserializeInt();
//     this.id = this.header & 0x3ff;

//     this.type = "UnknownFND";
//     if (!!FileNodeIDs[this.id]) {
//       this.type = FileNodeIDs[this.id][2];
//     }
//     this.size = (this.header >> 10) & 0x1fff;
//     this.stpFormat = (this.header >> 23) & 0x3;
//     this.cbFormat = (this.header >> 25) & 0x3;
//     this.baseType = (this.header >> 27) & 0xf;
//     this.reserved = this.header >> 31;
//   }
// }

// type ObjectPropSet = {
//   OIDs: ObjectSpaceObjectStreamOfIDs;
//   OSIDs: ObjectSpaceObjectStreamOfIDs | null;
//   ContextIDs: ObjectSpaceObjectStreamOfIDs | null;
//   body: PropertySet;
// };
// function ObjectSpaceObjectPropSet(reader: OneNoteReader): ObjectPropSet {
//   const OIDs = new ObjectSpaceObjectStreamOfIDs(reader);
//   const OSIDs = OIDs.header.OsidStreamNotPresent
//     ? null
//     : new ObjectSpaceObjectStreamOfIDs(reader);
//   const ContextIDs = OIDs.header.ExtendedStreamsPresent
//     ? new ObjectSpaceObjectStreamOfIDs(reader)
//     : null;
//   const body = new PropertySet(reader, OIDs, OSIDs, ContextIDs);
//   return { OIDs, OSIDs, ContextIDs, body };
// }

// class ObjectSpaceObjectStreamOfIDs {
//   readonly header: StreamHeader;
//   readonly body: CompactID[];
//   head: number = 0;
//   constructor(reader: OneNoteReader) {
//     this.header = ObjectSpaceObjectStreamHeader(reader);
//     this.body = [];
//     for (let i = 0; i < this.header.count; ++i) {
//       this.body.push(reader.deserializeCompactId());
//     }
//   }

//   read() {
//     return this.head < this.body.length ? this.body[this.head] : null;
//   }

//   reset() {
//     this.head = 0;
//   }
// }

// type StreamHeader = {
//   count: number;
//   ExtendedStreamsPresent: boolean;
//   OsidStreamNotPresent: boolean;
// };
// function ObjectSpaceObjectStreamHeader(reader: OneNoteReader): StreamHeader {
//   const data = reader.deserializeInt();
//   return {
//     count: data & 0xffffff,
//     ExtendedStreamsPresent: ((data >> 30) & 1) == 1,
//     OsidStreamNotPresent: ((data >> 31) & 1) == 1,
//   };
// }

// class PropertySet {
//   private formattedProperties: Record<string, any> | undefined;
//   readonly cProperties: number;
//   readonly rgPrids: PropertyID[];
//   readonly rgData: any[];
//   readonly offset: number;

//   constructor(
//     reader: OneNoteReader,
//     OIDs: ObjectSpaceObjectStreamOfIDs | null,
//     OSIDs: ObjectSpaceObjectStreamOfIDs | null,
//     ContextIDs: ObjectSpaceObjectStreamOfIDs | null
//   ) {
//     this.offset = reader.position;
//     this.cProperties = reader.deserializeShort();
//     this.rgPrids = [];
//     // TODO: const indent = "";
//     for (let i = 0; i < this.cProperties; ++i) {
//       this.rgPrids.push(PropertyID(reader));
//     }

//     this.rgData = [];
//     for (let i = 0; i < this.cProperties; ++i) {
//       const type = this.rgPrids[i].type;
//       switch (type) {
//         case 0x1:
//           this.rgData.push(null);
//           break;
//         case 0x2:
//           this.rgData.push(this.rgPrids[i].boolValue);
//           break;
//         case 0x3:
//           this.rgData.push(reader.deserializeByte());
//           break;
//         case 0x4:
//           this.rgData.push(reader.deserializeBytes(2));
//           break;
//         case 0x5:
//           this.rgData.push(reader.deserializeBytes(4));
//           break;
//         case 0x6:
//           this.rgData.push(reader.deserializeBytes(8));
//           break;
//         case 0x7:
//           this.rgData.push(new PrtFourBytesOfLengthFollowedByData(reader));
//           break;
//         case 0x8:
//         case 0x9: {
//           const count = type === 0x9 ? reader.deserializeInt() : 1;
//           this.rgData.push(this.getCompactIDs(OIDs, count));
//           break;
//         }
//         case 0xa:
//         case 0xb: {
//           const count = type === 0xb ? reader.deserializeInt() : 1;
//           this.rgData.push(this.getCompactIDs(OSIDs, count));
//           break;
//         }
//         case 0xc:
//         case 0xd: {
//           const count = type === 0xd ? reader.deserializeInt() : 1;
//           this.rgData.push(this.getCompactIDs(ContextIDs, count));
//           break;
//         }
//         case 0x10: {
//           const totalProperties = reader.deserializeInt();
//           PropertyID(reader);
//           const data: PropertySet[] = [];
//           for (let i = 0; i < totalProperties; ++i) {
//             data[i] = new PropertySet(reader, null, null, null);
//           }
//           this.rgData.push(data);
//           break;
//         }
//         case 0x11:
//           this.rgData.push(new PropertySet(reader, null, null, null));
//           break;
//         default:
//           throw new Error(`type is not valid. Type = ${type}`);
//       }
//     }

//     this.getProperties();
//   }

//   private getCompactIDs(
//     ids: ObjectSpaceObjectStreamOfIDs | null,
//     count: number
//   ) {
//     if (!ids) return [];
//     const data: (CompactID | null)[] = [];
//     for (let i = 0; i < count; ++i) {
//       data.push(ids.read());
//     }
//     return data;
//   }

//   getProperties() {
//     if (this.formattedProperties) return this.formattedProperties;

//     this.formattedProperties = {};
//     for (let i = 0; i < this.cProperties; ++i) {
//       const propertyName = this.rgPrids[i].name;
//       const propertyNameLower = propertyName.toLowerCase();
//       let propertyValue: any = null;

//       if (propertyName !== "Unknown") {
//         const propertyData = this.rgData[i];
//         if (propertyData instanceof PrtFourBytesOfLengthFollowedByData) {
//           if (propertyName === "RgOutlineIndentDistance") {
//             propertyValue = parseRgOutlineIndentDistance(propertyData);
//           } else if (propertyName === "NumberListFormat") {
//             propertyValue = parseNumberListFormat(propertyData);
//           } else if (propertyNameLower.includes("guid")) {
//             propertyValue = GUID.fromBuffer(propertyData.data);
//           } else if (propertyNameLower.includes("ascii")) {
//             propertyValue = propertyData.data.toString("ascii");
//           } else {
//             try {
//               propertyValue = propertyData.data
//                 .toString("utf16le")
//                 .replace("\u0000", "");
//             } catch {
//               propertyValue = propertyData.data.toString("hex");
//             }
//           }
//         } else if (propertyData instanceof Buffer) {
//           if (propertyNameLower.includes("time")) {
//             if (propertyData.length === 8) {
//               const timestampInNanoseconds = propertyData.readBigUint64LE();
//               propertyValue = PropertySet.parseFileTime(timestampInNanoseconds);
//             } else {
//               const timestampInSeconds = propertyData.readUInt32LE();
//               propertyValue = PropertySet.secondsToDateTime(timestampInSeconds);
//             }
//           } else if (
//             ["height", "width", "offset", "margin"].some((a) =>
//               propertyNameLower.includes(a)
//             )
//           ) {
//             const size = propertyData.readFloatLE();
//             propertyValue = PropertySet.halfInchSizeToPixels(size);
//           } else if (propertyNameLower.includes("langid")) {
//             const localeId = propertyData.readUInt16LE();
//             propertyValue = lcid.from(localeId);
//           } else if (propertyNameLower.includes("languageid")) {
//             const localeId = propertyData.readUInt32LE();
//             propertyValue = lcid.from(localeId);
//           } else {
//             propertyValue = propertyData[0];
//           }
//         }

//         if (propertyValue === null) {
//           propertyValue = propertyData;

//           // .toString();
//           // console.log(
//           //   "Unknown property type. Converting to string: ",
//           //   propertyValue
//           // );
//         }
//       }

//       this.formattedProperties[propertyName] = propertyValue;
//     }

//     return this.formattedProperties;
//   }

//   static halfInchSizeToPixels(width: number, dpi = 96) {
//     const pixelsPerHalfInch = dpi / 2;
//     return width * pixelsPerHalfInch;
//   }

//   static secondsToDateTime(seconds: number) {
//     // Define the starting time (12:00 A.M., January 1, 1980, UTC)
//     const start = new Date(1980, 1, 1, 0, 0, 0);
//     return new Date(start.getTime() + seconds * 1000);
//   }

//   static parseFileTime(timestamp: bigint) {
//     // Define the number of 100-nanosecond intervals in 1 second
//     const intervalsPerSecond = 10n ** 7n;

//     // Define the number of seconds between January 1, 1601 and January 1, 1970
//     const secondsBetweenEpochs = 11644473600n;

//     // Calculate the number of seconds represented by the FILETIME value
//     const seconds = timestamp / intervalsPerSecond;

//     const secondsSinceEpoch = seconds - secondsBetweenEpochs;

//     return new Date(
//       new Date(1970, 1, 1).getTime() + Number(secondsSinceEpoch) * 1000
//     );
//   }

//   toJSON() {
//     return this.formattedProperties;
//   }
// }

// class PrtFourBytesOfLengthFollowedByData {
//   readonly cb: number;
//   readonly data: Buffer;
//   constructor(reader: OneNoteReader) {
//     this.cb = reader.deserializeInt();
//     this.data = reader.deserializeBytes(this.cb);
//   }
// }

// function parseRgOutlineIndentDistance(ptr: PrtFourBytesOfLengthFollowedByData) {
//   const reader = new BufferReader(ptr.data, true); //.readUint8();
//   const count = reader.readUInt8();
//   reader.readBuffer(3);
//   const rgIndents = [];
//   for (let i = 0; i < count; ++i) {
//     rgIndents.push(reader.readFloat32());
//   }
//   return { count, rgIndents };
// }

// const NUMBER_LIST_FORMAT = {
//   0x00: "msonfcArabic",
//   0x01: "msonfcUCRoman",
//   0x02: "msonfcLCRoman",
//   0x03: "msonfcUCLetter",
//   0x04: "msonfcLCLetter",
//   0x05: "msonfcOrdinal",
//   0x06: "msonfcCardtext",
//   0x07: "msonfcOrdtext",
//   0x08: "msonfcHex",
//   0x09: "msonfcChiManSty",
//   0x0a: "msonfcDbNum1",
//   0x0b: "msonfcDbNum2",
//   0x0c: "msonfcAiueo",
//   0x0d: "msonfcIroha",
//   0x0e: "msonfcDbChar",
//   0x0f: "msonfcSbChar",
//   0x10: "msonfcDbNum3",
//   0x11: "msonfcDbNum4",
//   0x12: "msonfcCirclenum",
//   0x13: "msonfcDArabic",
//   0x14: "msonfcDAiueo",
//   0x15: "msonfcDIroha",
//   0x16: "msonfcArabicLZ",
//   0x17: "msonfcBullet",
//   0x18: "msonfcGanada",
//   0x19: "msonfcChosung",
//   0x1a: "msonfcGB1",
//   0x1b: "msonfcGB2",
//   0x1c: "msonfcGB3",
//   0x1d: "msonfcGB4",
//   0x1e: "msonfcZodiac1",
//   0x1f: "msonfcZodiac2",
//   0x20: "msonfcZodiac3",
//   0x21: "msonfcTpeDbNum1",
//   0x22: "msonfcTpeDbNum2",
//   0x23: "msonfcTpeDbNum3",
//   0x24: "msonfcTpeDbNum4",
//   0x25: "msonfcChnDbNum1",
//   0x26: "msonfcChnDbNum2",
//   0x27: "msonfcChnDbNum3",
//   0x28: "msonfcChnDbNum4",
//   0x29: "msonfcKorDbNum1",
//   0x2a: "msonfcKorDbNum2",
//   0x2b: "msonfcKorDbNum3",
//   0x2c: "msonfcKorDbNum4",
//   0x2d: "msonfcHebrew1",
//   0x2e: "msonfcArabic1",
//   0x2f: "msonfcHebrew2",
//   0x30: "msonfcArabic2",
//   0x31: "msonfcHindi1",
//   0x32: "msonfcHindi2",
//   0x33: "msonfcHindi3",
//   0x34: "msonfcHindi4",
//   0x35: "msonfcThai1",
//   0x36: "msonfcThai2",
//   0x37: "msonfcThai3",
//   0x38: "msonfcViet1",
//   0x39: "msonfcNumInDash",
//   0x3a: "msonfcLCRus",
//   0x3b: "msonfcUCRus",
//   0xff: "msonfcNone",
// };
// function parseNumberListFormat(ptr: PrtFourBytesOfLengthFollowedByData) {
//   const reader = new BufferReader(ptr.data, true);
//   reader.readUInt8();
//   const isNumbered = reader.readUInt8() === 0xfffd;
//   const numberFormat =
//     NUMBER_LIST_FORMAT[reader.readUInt8() as keyof typeof NUMBER_LIST_FORMAT];
//   return {
//     isNumbered: isNumbered && !!numberFormat,
//     numberFormat,
//   };
// }

// const PROPERTY_ID_MAP = {
//   0x08001c00: "LayoutTightLayout",
//   0x14001c01: "PageWidth",
//   0x14001c02: "PageHeight",
//   0x0c001c03: "OutlineElementChildLevel",
//   0x08001c04: "Bold",
//   0x08001c05: "Italic",
//   0x08001c06: "Underline",
//   0x08001c07: "Strikethrough",
//   0x08001c08: "Superscript",
//   0x08001c09: "Subscript",
//   0x1c001c0a: "Font",
//   0x10001c0b: "FontSize",
//   0x14001c0c: "FontColor",
//   0x14001c0d: "Highlight",
//   0x1c001c12: "RgOutlineIndentDistance",
//   0x0c001c13: "BodyTextAlignment",
//   0x14001c14: "OffsetFromParentHoriz",
//   0x14001c15: "OffsetFromParentVert",
//   0x1c001c1a: "NumberListFormat",
//   0x14001c1b: "LayoutMaxWidth",
//   0x14001c1c: "LayoutMaxHeight",
//   // 0x24001c1f: "ContentChildNodesOfOutlineElement",
//   0x24001c1f: "ContentChildNodesOfPageManifest",
//   // 0x24001c20: "ElementChildNodesOfSection",
//   // 0x24001c20: "ElementChildNodesOfPage",
//   // 0x24001c20: "ElementChildNodesOfTitle",
//   // 0x24001c20: "ElementChildNodesOfOutline",
//   // 0x24001c20: "ElementChildNodesOfOutlineElement",
//   // 0x24001c20: "ElementChildNodesOfTable",
//   // 0x24001c20: "ElementChildNodesOfTableRow",
//   // 0x24001c20: "ElementChildNodesOfTableCell",
//   0x24001c20: "ElementChildNodesOfVersionHistory",
//   0x08001e1e: "EnableHistory",
//   0x1c001c22: "RichEditTextUnicode",
//   0x24001c26: "ListNodes",
//   0x1c001c30: "NotebookManagementEntityGuid",
//   0x08001c34: "OutlineElementRTL",
//   0x14001c3b: "LanguageID",
//   0x14001c3e: "LayoutAlignmentInParent",
//   0x20001c3f: "PictureContainer",
//   0x14001c4c: "PageMarginTop",
//   0x14001c4d: "PageMarginBottom",
//   0x14001c4e: "PageMarginLeft",
//   0x14001c4f: "PageMarginRight",
//   0x1c001c52: "ListFont",
//   0x18001c65: "TopologyCreationTimeStamp",
//   0x14001c84: "LayoutAlignmentSelf",
//   0x08001c87: "IsTitleTime",
//   0x08001c88: "IsBoilerText",
//   0x14001c8b: "PageSize",
//   0x08001c8e: "PortraitPage",
//   0x08001c91: "EnforceOutlineStructure",
//   0x08001c92: "EditRootRTL",
//   0x08001cb2: "CannotBeSelected",
//   0x08001cb4: "IsTitleText",
//   0x08001cb5: "IsTitleDate",
//   0x14001cb7: "ListRestart",
//   0x08001cbd: "IsLayoutSizeSetByUser",
//   0x14001ccb: "ListSpacingMu",
//   0x14001cdb: "LayoutOutlineReservedWidth",
//   0x08001cdc: "LayoutResolveChildCollisions",
//   0x08001cde: "IsReadOnly",
//   0x14001cec: "LayoutMinimumOutlineWidth",
//   0x14001cf1: "LayoutCollisionPriority",
//   0x1c001cf3: "CachedTitleString",
//   0x08001cf9: "DescendantsCannotBeMoved",
//   0x10001cfe: "RichEditTextLangID",
//   0x08001cff: "LayoutTightAlignment",
//   0x0c001d01: "Charset",
//   0x14001d09: "CreationTimeStamp",
//   0x08001d0c: "Deletable",
//   0x10001d0e: "ListMSAAIndex",
//   0x08001d13: "IsBackground",
//   0x14001d24: "IRecordMedia",
//   0x1c001d3c: "CachedTitleStringFromPage",
//   0x14001d57: "RowCount",
//   0x14001d58: "ColumnCount",
//   0x08001d5e: "TableBordersVisible",
//   0x24001d5f: "StructureElementChildNodes",
//   0x2c001d63: "ChildGraphSpaceElementNodes",
//   0x1c001d66: "TableColumnWidths",
//   0x1c001d75: "Author",
//   0x18001d77: "LastModifiedTimeStamp",
//   0x20001d78: "AuthorOriginal",
//   0x20001d79: "AuthorMostRecent",
//   0x14001d7a: "LastModifiedTime",
//   0x08001d7c: "IsConflictPage",
//   0x1c001d7d: "TableColumnsLocked",
//   0x14001d82: "SchemaRevisionInOrderToRead",
//   0x08001d96: "IsConflictObjectForRender",
//   0x20001d9b: "EmbeddedFileContainer",
//   0x1c001d9c: "EmbeddedFileName",
//   0x1c001d9d: "SourceFilepath",
//   0x1c001d9e: "ConflictingUserName",
//   0x1c001dd7: "ImageFilename",
//   0x08001ddb: "IsConflictObjectForSelection",
//   0x14001dff: "PageLevel",
//   0x1c001e12: "TextRunIndex",
//   0x24001e13: "TextRunFormatting",
//   0x08001e14: "Hyperlink",
//   0x0c001e15: "UnderlineType",
//   0x08001e16: "Hidden",
//   0x08001e19: "HyperlinkProtected",
//   0x08001e22: "TextRunIsEmbeddedObject",
//   0x14001e26: "CellShadingColor",
//   0x1c001e58: "ImageAltText",
//   0x08003401: "MathFormatting",
//   0x2000342c: "ParagraphStyle",
//   0x1400342e: "ParagraphSpaceBefore",
//   0x1400342f: "ParagraphSpaceAfter",
//   0x14003430: "ParagraphLineSpacingExact",
//   0x24003442: "MetaDataObjectsAboveGraphSpace",
//   0x24003458: "TextRunDataObject",
//   0x40003499: "TextRunData",
//   0x1c00345a: "ParagraphStyleId",
//   0x08003462: "HasVersionPages",
//   0x10003463: "ActionItemType",
//   0x10003464: "NoteTagShape",
//   0x14003465: "NoteTagHighlightColor",
//   0x14003466: "NoteTagTextColor",
//   0x14003467: "NoteTagPropertyStatus",
//   0x1c003468: "NoteTagLabel",
//   0x1400346e: "NoteTagCreated",
//   0x1400346f: "NoteTagCompleted",
//   0x20003488: "NoteTagDefinitionOid",
//   0x04003489: "NoteTagStates",
//   0x10003470: "ActionItemStatus",
//   0x0c003473: "ActionItemSchemaVersion",
//   0x08003476: "ReadingOrderRTL",
//   0x0c003477: "ParagraphAlignment",
//   0x3400347b: "VersionHistoryGraphSpaceContextNodes",
//   0x14003480: "DisplayedPageNumber",
//   0x1c00349b: "SectionDisplayName",
//   0x1c00348a: "NextStyle",
//   0x200034c8: "WebPictureContainer14",
//   0x140034cb: "ImageUploadState",
//   0x1c003498: "TextExtendedAscii",
//   0x140034cd: "PictureWidth",
//   0x140034ce: "PictureHeight",
//   0x14001d0f: "PageMarginOriginX",
//   0x14001d10: "PageMarginOriginY",
//   0x1c001e20: "WzHyperlinkUrl",
//   0x1400346b: "TaskTagDueDate",
//   0x1c001de9: "IsDeletedGraphSpaceContent",
// };

// type PropertyID = {
//   id: number;
//   type: number;
//   boolValue: boolean;
//   value: number;
//   name: string;
// };
// function PropertyID(reader: OneNoteReader): PropertyID {
//   const value = reader.deserializeInt();
//   const id = value & 0x3ffffff;
//   const type = (value >> 26) & 0x1f;
//   const boolValue = ((value >> 31) & 1) == 1;
//   return {
//     id,
//     type,
//     boolValue,
//     value,
//     name: PROPERTY_ID_MAP[value as keyof typeof PROPERTY_ID_MAP] || "Unknown",
//   };
// }
