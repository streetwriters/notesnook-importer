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

import { OneNoteProperties } from "../properties";
import { OneNoteReader } from "../reader";
import {
  CBFormat,
  CbFormatFromNumber,
  STPFormat,
  StpFormatFromNumber,
} from "../utils/file-chunk-reference";
import { FileNodeList } from "./file-node-list";
import {
  BaseType,
  FileNodeDataParser,
  FileNodeID,
  FileNodeTypes,
} from "./file-node-types";
import { ObjectSpaceObjectPropSet } from "./file-node-types/shared/ObjectSpaceObjectPropSet";
import { PropertyType } from "./file-node-types/shared/PropertyID";

type Types = typeof FileNodeTypes;
type FileNodeData<TID extends FileNodeID> = ReturnType<Types[TID][1]>;

type C = FileNodeData<FileNodeID.ObjectSpaceManifestRootFND>;
/**
 * A {@link FileNode} structure is the basic unit for holding and referencing data in the file. FileNode structures are organized into file node lists (section 2.4).
 *
 * A {@link FileNode} structure is divided into header fields and a data field, fnd. The header fields specify what type of FileNode structure it is, and what format the fnd field is in. The fnd field can be empty, or it can contain data directly, or it can contain a reference to another block of the file by byte position and byte count, or it can contain both data and a reference.
 */
export class FileNode<TID extends FileNodeID = FileNodeID> {
  /**
   * An unsigned integer that specifies the type of this FileNode structure. The meaning of this value is specified by the fnd field.
   */
  readonly FileNodeID: TID;

  /**
   * An unsigned integer that specifies the size, in bytes, of this FileNode structure.
   */
  readonly size: number;

  readonly header: number;
  // readonly type: FileNodeType = "UnknownFND";

  readonly stpFormat: STPFormat;
  readonly cbFormat: CBFormat;
  readonly baseType: BaseType;
  readonly reserved: number;

  readonly data: FileNodeData<TID> = false as FileNodeData<TID>;
  readonly children: FileNodeList[] = [];

  constructor(reader: OneNoteReader) {
    this.header = reader.deserializeInt();

    this.FileNodeID = (this.header & 0x3ff) as TID;
    // if (this.FileNodeID === 0) {
    //   console.log(this.header);
    // }
    // console.log(this.FileNodeID, reader.position);

    this.size = (this.header >> 10) & 0x1fff;

    this.stpFormat = StpFormatFromNumber((this.header >> 23) & 0x3);
    this.cbFormat = CbFormatFromNumber((this.header >> 25) & 0x3);

    this.baseType = (this.header >> 27) & 0xf;
    this.reserved = this.header >> 31;

    const fileNodeDataParser: FileNodeDataParser | undefined = FileNodeTypes[
      this.FileNodeID
    ]
      ? FileNodeTypes[this.FileNodeID][1]
      : undefined;

    if (fileNodeDataParser) {
      this.data = fileNodeDataParser(reader, this) as FileNodeData<TID>;
    } else if (this.FileNodeID !== FileNodeID.UnknownFND) {
      // Unknown node types can appear in files written by newer OneNote
      // versions. Skip their (declared) data so the stream stays aligned.
      const dataSize = this.size - 4;
      if (dataSize > 0) reader.seek(reader.position + dataSize);
    }

    const currentOffset = reader.position;
    if (
      this.baseType === BaseType.FILE_NODE_LIST &&
      typeof this.data === "object" &&
      "ref" in this.data
    ) {
      this.children.push(new FileNodeList(reader, this.data.ref));
    }
    reader.seek(currentOffset);
  }

  is<TID extends FileNodeID>(id: TID): this is FileNode<TID> {
    return (this.FileNodeID as FileNodeID) === id;
  }
}
