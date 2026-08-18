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

import { OneNoteReader } from "../../reader";
import { FileNode } from "../file-node";
import { DataSignatureGroupDefinitionFND } from "./DataSignatureGroupDefinitionFND";
import { FileDataStoreListReferenceFND } from "./FileDataStoreListReferenceFND";
import { FileDataStoreObjectReferenceFND } from "./FileDataStoreObjectReferenceFND";
import { GlobalIdTableEntry2FNDX } from "./GlobalIdTableEntry2FNDX";
import { GlobalIdTableEntry3FNDX } from "./GlobalIdTableEntry3FNDX";
import { GlobalIdTableEntryFNDX } from "./GlobalIdTableEntryFNDX";
import { GlobalIdTableStartFNDX } from "./GlobalIdTableStartFNDX";
import { HashedChunkDescriptor2FND } from "./HashedChunkDescriptor2FND";
import { ObjectDataEncryptionKeyV2FNDX } from "./ObjectDataEncryptionKeyV2FNDX";
import { ObjectDeclaration2LargeRefCountFND } from "./ObjectDeclaration2LargeRefCountFND";
import { ObjectDeclaration2RefCountFND } from "./ObjectDeclaration2RefCountFND";
import { ObjectDeclarationFileData3LargeRefCountFND } from "./ObjectDeclarationFileData3LargeRefCountFND";
import { ObjectDeclarationFileData3RefCountFND } from "./ObjectDeclarationFileData3RefCountFND";
import { ObjectDeclarationWithRefCount2FNDX } from "./ObjectDeclarationWithRefCount2FNDX";
import { ObjectDeclarationWithRefCountFNDX } from "./ObjectDeclarationWithRefCountFNDX";
import { ObjectGroupListReferenceFND } from "./ObjectGroupListReferenceFND";
import { ObjectGroupStartFND } from "./ObjectGroupStartFND";
import { ObjectInfoDependencyOverridesFND } from "./ObjectInfoDependencyOverridesFND";
import { ObjectRevisionWithRefCount2FNDX } from "./ObjectRevisionWithRefCount2FNDX";
import { ObjectRevisionWithRefCountFNDX } from "./ObjectRevisionWithRefCountFNDX";
import { ObjectSpaceManifestListReferenceFND } from "./ObjectSpaceManifestListReferenceFND";
import { ObjectSpaceManifestListStartFND } from "./ObjectSpaceManifestListStartFND";
import { ObjectSpaceManifestRootFND } from "./ObjectSpaceManifestRootFND";
import { ReadOnlyObjectDeclaration2LargeRefCountFND } from "./ReadOnlyObjectDeclaration2LargeRefCountFND";
import { ReadOnlyObjectDeclaration2RefCountFND } from "./ReadOnlyObjectDeclaration2RefCountFND";
import { RevisionManifestListReferenceFND } from "./RevisionManifestListReferenceFND";
import { RevisionManifestListStartFND } from "./RevisionManifestListStartFND";
import { RevisionManifestStart4FND } from "./RevisionManifestStart4FND";
import { RevisionManifestStart6FND } from "./RevisionManifestStart6FND";
import { RevisionManifestStart7FND } from "./RevisionManifestStart7FND";
import { RevisionRoleAndContextDeclarationFND } from "./RevisionRoleAndContextDeclarationFND";
import { RevisionRoleDeclarationFND } from "./RevisionRoleDeclarationFND";
import { RootObjectReference2FNDX } from "./RootObjectReference2FNDX";
import { RootObjectReference3FND } from "./RootObjectReference3FND";

export enum BaseType {
  NIL = -1,
  /**
   * This FileNode structure does not reference other data.
   */
  NO_DATA = 0,
  /**
   * This FileNode structure contains a reference to data.
   */
  DATA = 1,
  /**
   * This FileNode structure contains a reference to a file node list.
   */
  FILE_NODE_LIST = 2,
}

export type FileNodeDataParser = (
  reader: OneNoteReader,
  fileNode: FileNode,
) =>
  | ObjectSpaceManifestRootFND
  | ObjectSpaceManifestListReferenceFND
  | ObjectSpaceManifestListStartFND
  | RevisionManifestListReferenceFND
  | RevisionManifestListStartFND
  | RevisionManifestStart4FND
  | RevisionManifestStart6FND
  | RevisionManifestStart7FND
  | GlobalIdTableStartFNDX
  | GlobalIdTableEntryFNDX
  | GlobalIdTableEntry2FNDX
  | GlobalIdTableEntry3FNDX
  | ObjectDeclarationWithRefCountFNDX
  | ObjectDeclarationWithRefCount2FNDX
  | ObjectRevisionWithRefCountFNDX
  | ObjectRevisionWithRefCount2FNDX
  | RootObjectReference2FNDX
  | RootObjectReference3FND
  | RevisionRoleDeclarationFND
  | RevisionRoleAndContextDeclarationFND
  | ObjectDeclarationFileData3RefCountFND
  | ObjectDeclarationFileData3LargeRefCountFND
  | ObjectDataEncryptionKeyV2FNDX
  | ObjectInfoDependencyOverridesFND
  | DataSignatureGroupDefinitionFND
  | FileDataStoreListReferenceFND
  | FileDataStoreObjectReferenceFND
  | ObjectDeclaration2RefCountFND
  | ObjectDeclaration2LargeRefCountFND
  | ObjectGroupListReferenceFND
  | ObjectGroupStartFND
  | ReadOnlyObjectDeclaration2RefCountFND
  | ReadOnlyObjectDeclaration2LargeRefCountFND;

export enum FileNodeID {
  ObjectSpaceManifestRootFND = 0x004,
  ObjectSpaceManifestListReferenceFND = 0x008,
  ObjectSpaceManifestListStartFND = 0x00c,
  RevisionManifestListReferenceFND = 0x010,
  RevisionManifestListStartFND = 0x014,
  RevisionManifestStart4FND = 0x01b,
  RevisionManifestEndFND = 0x01c,
  RevisionManifestStart6FND = 0x01e,
  RevisionManifestStart7FND = 0x01f,
  GlobalIdTableStartFNDX = 0x021,
  GlobalIdTableStart2FND = 0x022,
  GlobalIdTableEntryFNDX = 0x024,
  GlobalIdTableEntry2FNDX = 0x025,
  GlobalIdTableEntry3FNDX = 0x026,
  GlobalIdTableEndFNDX = 0x028,
  ObjectDeclarationWithRefCountFNDX = 0x02d,
  ObjectDeclarationWithRefCount2FNDX = 0x02e,
  ObjectRevisionWithRefCountFNDX = 0x041,
  ObjectRevisionWithRefCount2FNDX = 0x042,
  RootObjectReference2FNDX = 0x059,
  RootObjectReference3FND = 0x05a,
  RevisionRoleDeclarationFND = 0x05c,
  RevisionRoleAndContextDeclarationFND = 0x05d,
  ObjectDeclarationFileData3RefCountFND = 0x072,
  ObjectDeclarationFileData3LargeRefCountFND = 0x073,
  ObjectDataEncryptionKeyV2FNDX = 0x07c,
  ObjectInfoDependencyOverridesFND = 0x084,
  DataSignatureGroupDefinitionFND = 0x08c,
  FileDataStoreListReferenceFND = 0x090,
  FileDataStoreObjectReferenceFND = 0x094,
  ObjectDeclaration2RefCountFND = 0x0a4,
  ObjectDeclaration2LargeRefCountFND = 0x0a5,
  ObjectGroupListReferenceFND = 0x0b0,
  ObjectGroupStartFND = 0x0b4,
  ObjectGroupEndFND = 0x0b8,
  HashedChunkDescriptor2FND = 0x0c2,
  ReadOnlyObjectDeclaration2RefCountFND = 0x0c4,
  ReadOnlyObjectDeclaration2LargeRefCountFND = 0x0c5,
  ChunkTerminatorFND = 0x0ff,
  UnknownFND = 0,

  // ObjectSpaceManifestRootFND = 0x004,
  // ObjectSpaceManifestListReferenceFND = 0x008,
  // ObjectSpaceManifestListStartFND = 0x00c,
  // RevisionManifestListReferenceFND = 0x010,
  // RevisionManifestListStartFND = 0x014,
  // RevisionManifestStart4FND = 0x01b,
  // RevisionManifestEndFND = 0x01c,
  // RevisionManifestStart6FND = 0x01e,
  // RevisionManifestStart7FND = 0x01f,
  // GlobalIdTableStartFNDX = 0x021,
  // GlobalIdTableStart2FND = 0x022,
  // GlobalIdTableEntryFNDX = 0x024,
  // GlobalIdTableEntry2FNDX = 0x025,
  // GlobalIdTableEntry3FNDX = 0x026,
  // GlobalIdTableEndFNDX = 0x028,
  // ObjectDeclarationWithRefCountFNDX = 0x041,
  // ObjectDeclarationWithRefCount2FNDX = 0x042,
  // ObjectRevisionWithRefCountFNDX = 0x059,
  // ObjectRevisionWithRefCount2FNDX = 0x05a,
  // RootObjectReference2FNDX = 0x05c,
  // RootObjectReference3FND = 0x05d,
  // RevisionRoleDeclarationFND = 0x07c,
  // RevisionRoleAndContextDeclarationFND = 0x084,
  // ObjectDeclarationFileData3RefCountFND = 0x090,
  // ObjectDeclarationFileData3LargeRefCountFND = 0x094,
  // ObjectDataEncryptionKeyV2FNDX = 0x02d,
  // ObjectInfoDependencyOverridesFND = 0x02e,
  // DataSignatureGroupDefinitionFND = 0x0a4,
  // FileDataStoreListReferenceFND = 0x0a5,
  // FileDataStoreObjectReferenceFND = 0x072,
  // ObjectDeclaration2RefCountFND = 0x073,
  // ObjectDeclaration2LargeRefCountFND = 0x0c4,
  // ObjectGroupListReferenceFND = 0x0c5,
  // ObjectGroupStartFND = 0x0b0,
  // ObjectGroupEndFND = 0x0b4,
  // HashedChunkDescriptor2FND = 0x08c,
  // ReadOnlyObjectDeclaration2RefCountFND = 0x0b8,
  // ReadOnlyObjectDeclaration2LargeRefCountFND = 0x0c2,
  // ChunkTerminatorFND = 0x0ff,
  // UnknownFND = 0,
}

export const FileNodeTypes = {
  [FileNodeID.ObjectSpaceManifestRootFND]: [
    BaseType.NO_DATA,
    ObjectSpaceManifestRootFND,
  ],
  [FileNodeID.ObjectSpaceManifestListReferenceFND]: [
    BaseType.FILE_NODE_LIST,
    ObjectSpaceManifestListReferenceFND,
  ],
  [FileNodeID.ObjectSpaceManifestListStartFND]: [
    BaseType.NO_DATA,
    ObjectSpaceManifestListStartFND,
  ],
  [FileNodeID.RevisionManifestListReferenceFND]: [
    BaseType.FILE_NODE_LIST,
    RevisionManifestListReferenceFND,
  ],
  [FileNodeID.RevisionManifestListStartFND]: [
    BaseType.NO_DATA,
    RevisionManifestListStartFND,
  ],
  [FileNodeID.RevisionManifestStart4FND]: [
    BaseType.NO_DATA,
    RevisionManifestStart4FND,
  ],
  [FileNodeID.RevisionManifestEndFND]: [
    BaseType.NO_DATA,
    NOOP,
    // RevisionManifestEndFND,
  ],
  [FileNodeID.RevisionManifestStart6FND]: [
    BaseType.NO_DATA,
    RevisionManifestStart6FND,
  ],
  [FileNodeID.RevisionManifestStart7FND]: [
    BaseType.NO_DATA,
    RevisionManifestStart7FND,
  ],
  [FileNodeID.GlobalIdTableStartFNDX]: [
    BaseType.NO_DATA,
    GlobalIdTableStartFNDX,
  ],
  [FileNodeID.GlobalIdTableStart2FND]: [BaseType.NO_DATA, NOOP],
  [FileNodeID.GlobalIdTableEntryFNDX]: [
    BaseType.NO_DATA,
    GlobalIdTableEntryFNDX,
  ],
  [FileNodeID.GlobalIdTableEntry2FNDX]: [
    BaseType.NO_DATA,
    GlobalIdTableEntry2FNDX,
  ],
  [FileNodeID.GlobalIdTableEntry3FNDX]: [
    BaseType.NO_DATA,
    GlobalIdTableEntry3FNDX,
  ],
  [FileNodeID.GlobalIdTableEndFNDX]: [BaseType.NO_DATA, NOOP],
  [FileNodeID.ObjectDeclarationWithRefCountFNDX]: [
    BaseType.DATA,
    ObjectDeclarationWithRefCountFNDX,
  ],
  [FileNodeID.ObjectDeclarationWithRefCount2FNDX]: [
    BaseType.DATA,
    ObjectDeclarationWithRefCount2FNDX,
  ],
  [FileNodeID.ObjectRevisionWithRefCountFNDX]: [
    BaseType.DATA,
    ObjectRevisionWithRefCountFNDX,
  ],
  [FileNodeID.ObjectRevisionWithRefCount2FNDX]: [
    BaseType.DATA,
    ObjectRevisionWithRefCount2FNDX,
  ],
  [FileNodeID.RootObjectReference2FNDX]: [
    BaseType.NO_DATA,
    RootObjectReference2FNDX,
  ],
  [FileNodeID.RootObjectReference3FND]: [
    BaseType.NO_DATA,
    RootObjectReference3FND,
  ],
  [FileNodeID.RevisionRoleDeclarationFND]: [
    BaseType.NO_DATA,
    RevisionRoleDeclarationFND,
  ],
  [FileNodeID.RevisionRoleAndContextDeclarationFND]: [
    BaseType.NO_DATA,
    RevisionRoleAndContextDeclarationFND,
  ],
  [FileNodeID.ObjectDeclarationFileData3RefCountFND]: [
    BaseType.NO_DATA,
    ObjectDeclarationFileData3RefCountFND,
  ],
  [FileNodeID.ObjectDeclarationFileData3LargeRefCountFND]: [
    BaseType.NO_DATA,
    ObjectDeclarationFileData3LargeRefCountFND,
  ],
  [FileNodeID.ObjectDataEncryptionKeyV2FNDX]: [
    BaseType.DATA,
    ObjectDataEncryptionKeyV2FNDX,
  ],
  [FileNodeID.ObjectInfoDependencyOverridesFND]: [
    BaseType.DATA,
    ObjectInfoDependencyOverridesFND,
  ],
  [FileNodeID.DataSignatureGroupDefinitionFND]: [
    BaseType.NO_DATA,
    DataSignatureGroupDefinitionFND,
  ],
  [FileNodeID.FileDataStoreListReferenceFND]: [
    BaseType.FILE_NODE_LIST,
    FileDataStoreListReferenceFND,
  ],
  [FileNodeID.FileDataStoreObjectReferenceFND]: [
    BaseType.DATA,
    FileDataStoreObjectReferenceFND,
  ],
  [FileNodeID.ObjectDeclaration2RefCountFND]: [
    BaseType.DATA,
    ObjectDeclaration2RefCountFND,
  ],
  [FileNodeID.ObjectDeclaration2LargeRefCountFND]: [
    BaseType.DATA,
    ObjectDeclaration2LargeRefCountFND,
  ],
  [FileNodeID.ObjectGroupListReferenceFND]: [
    BaseType.FILE_NODE_LIST,
    ObjectGroupListReferenceFND,
  ],
  [FileNodeID.ObjectGroupStartFND]: [BaseType.NO_DATA, ObjectGroupStartFND],
  [FileNodeID.ObjectGroupEndFND]: [BaseType.NO_DATA, NOOP],
  [FileNodeID.HashedChunkDescriptor2FND]: [
    BaseType.DATA,
    HashedChunkDescriptor2FND,
  ],
  [FileNodeID.ReadOnlyObjectDeclaration2RefCountFND]: [
    BaseType.DATA,
    ReadOnlyObjectDeclaration2RefCountFND,
  ],
  [FileNodeID.ReadOnlyObjectDeclaration2LargeRefCountFND]: [
    BaseType.DATA,
    ReadOnlyObjectDeclaration2LargeRefCountFND,
  ],
  [FileNodeID.ChunkTerminatorFND]: [BaseType.FILE_NODE_LIST, NOOP],
  [FileNodeID.UnknownFND]: [BaseType.NIL, NOOP],
  // [FileNodeID.ObjectSpaceManifestRootFND]: [
  //   BaseType.NO_DATA,
  //   ObjectSpaceManifestRootFND,
  // ],
  // [FileNodeID.ObjectSpaceManifestListReferenceFND]: [
  //   BaseType.FILE_NODE_LIST,
  //   ObjectSpaceManifestListReferenceFND,
  // ],
  // [FileNodeID.ObjectSpaceManifestListStartFND]: [
  //   BaseType.NO_DATA,
  //   ObjectSpaceManifestListStartFND,
  // ],
  // [FileNodeID.RevisionManifestListReferenceFND]: [
  //   BaseType.FILE_NODE_LIST,
  //   RevisionManifestListReferenceFND,
  // ],
  // [FileNodeID.RevisionManifestListStartFND]: [
  //   BaseType.NO_DATA,
  //   RevisionManifestListStartFND,
  // ],
  // [FileNodeID.RevisionManifestStart4FND]: [
  //   BaseType.NO_DATA,
  //   RevisionManifestStart4FND,
  // ],
  // [FileNodeID.RevisionManifestEndFND]: [BaseType.NO_DATA, NOOP],
  // [FileNodeID.RevisionManifestStart6FND]: [
  //   BaseType.NO_DATA,
  //   RevisionManifestStart6FND,
  // ],
  // [FileNodeID.RevisionManifestStart7FND]: [
  //   BaseType.NO_DATA,
  //   RevisionManifestStart7FND,
  // ],
  // [FileNodeID.GlobalIdTableStartFNDX]: [
  //   BaseType.NO_DATA,
  //   GlobalIdTableStartFNDX,
  // ],
  // [FileNodeID.GlobalIdTableStart2FND]: [BaseType.NO_DATA, NOOP],
  // [FileNodeID.GlobalIdTableEntryFNDX]: [
  //   BaseType.NO_DATA,
  //   GlobalIdTableEntryFNDX,
  // ],
  // [FileNodeID.GlobalIdTableEntry2FNDX]: [
  //   BaseType.NO_DATA,
  //   GlobalIdTableEntry2FNDX,
  // ],
  // [FileNodeID.GlobalIdTableEntry3FNDX]: [
  //   BaseType.NO_DATA,
  //   GlobalIdTableEntry3FNDX,
  // ],
  // [FileNodeID.GlobalIdTableEndFNDX]: [BaseType.NO_DATA, NOOP],
  // [FileNodeID.ObjectDeclarationWithRefCountFNDX]: [
  //   BaseType.DATA,
  //   ObjectRevisionWithRefCountFNDX,
  // ],
  // [FileNodeID.ObjectDeclarationWithRefCount2FNDX]: [
  //   BaseType.DATA,
  //   ObjectRevisionWithRefCount2FNDX,
  // ],
  // [FileNodeID.ObjectRevisionWithRefCountFNDX]: [
  //   BaseType.NO_DATA,
  //   RootObjectReference2FNDX,
  // ],
  // [FileNodeID.ObjectRevisionWithRefCount2FNDX]: [
  //   BaseType.NO_DATA,
  //   RootObjectReference3FND,
  // ],
  // [FileNodeID.RootObjectReference2FNDX]: [
  //   BaseType.NO_DATA,
  //   RevisionRoleDeclarationFND,
  // ],
  // [FileNodeID.RootObjectReference3FND]: [
  //   BaseType.NO_DATA,
  //   RevisionRoleAndContextDeclarationFND,
  // ],
  // [FileNodeID.RevisionRoleDeclarationFND]: [
  //   BaseType.DATA,
  //   ObjectDataEncryptionKeyV2FNDX,
  // ],
  // [FileNodeID.RevisionRoleAndContextDeclarationFND]: [
  //   BaseType.DATA,
  //   ObjectInfoDependencyOverridesFND,
  // ],
  // [FileNodeID.ObjectDeclarationFileData3RefCountFND]: [
  //   BaseType.FILE_NODE_LIST,
  //   FileDataStoreListReferenceFND,
  // ],
  // [FileNodeID.ObjectDeclarationFileData3LargeRefCountFND]: [
  //   BaseType.DATA,
  //   FileDataStoreObjectReferenceFND,
  // ],
  // [FileNodeID.ObjectDataEncryptionKeyV2FNDX]: [
  //   BaseType.DATA,
  //   ObjectDeclarationWithRefCountFNDX,
  // ],
  // [FileNodeID.ObjectInfoDependencyOverridesFND]: [
  //   BaseType.DATA,
  //   ObjectDeclarationWithRefCount2FNDX,
  // ],
  // [FileNodeID.DataSignatureGroupDefinitionFND]: [
  //   BaseType.DATA,
  //   ObjectDeclaration2RefCountFND,
  // ],
  // [FileNodeID.FileDataStoreListReferenceFND]: [
  //   BaseType.DATA,
  //   ObjectDeclaration2LargeRefCountFND,
  // ],
  // [FileNodeID.FileDataStoreObjectReferenceFND]: [
  //   BaseType.NO_DATA,
  //   ObjectDeclarationFileData3RefCountFND,
  // ],
  // [FileNodeID.ObjectDeclaration2RefCountFND]: [
  //   BaseType.NO_DATA,
  //   ObjectDeclarationFileData3LargeRefCountFND,
  // ],
  // [FileNodeID.ObjectDeclaration2LargeRefCountFND]: [
  //   BaseType.DATA,
  //   ReadOnlyObjectDeclaration2RefCountFND,
  // ],
  // [FileNodeID.ObjectGroupListReferenceFND]: [
  //   BaseType.DATA,
  //   ReadOnlyObjectDeclaration2LargeRefCountFND,
  // ],
  // [FileNodeID.ObjectGroupStartFND]: [
  //   BaseType.FILE_NODE_LIST,
  //   ObjectGroupListReferenceFND,
  // ],
  // [FileNodeID.ObjectGroupEndFND]: [BaseType.NO_DATA, ObjectGroupStartFND],
  // [FileNodeID.HashedChunkDescriptor2FND]: [
  //   BaseType.NO_DATA,
  //   DataSignatureGroupDefinitionFND,
  // ],
  // [FileNodeID.ReadOnlyObjectDeclaration2RefCountFND]: [BaseType.NO_DATA, NOOP],
  // [FileNodeID.ReadOnlyObjectDeclaration2LargeRefCountFND]: [
  //   BaseType.DATA,
  //   NOOP,
  // ],
  // [FileNodeID.ChunkTerminatorFND]: [BaseType.NIL, NOOP],
  // [FileNodeID.UnknownFND]: [BaseType.NIL, NOOP],
} as const;

function NOOP(): false {
  return false;
}
