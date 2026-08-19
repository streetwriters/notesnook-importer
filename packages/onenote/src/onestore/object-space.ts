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

import { CompactID, JCID, OneNoteReader } from "../reader";
import { ExtendedGUID, GUID } from "../utils/guid";
import { OneStore } from "./index";
import { FileNode } from "./file-node";
import { FileNodeID } from "./file-node-types";
import { FileNodeList } from "./file-node-list";
import { ObjectSpaceObjectPropSet } from "./file-node-types/shared/ObjectSpaceObjectPropSet";
import { decode } from "../utils/reader";
import { parseEncryptionXml, decryptObjectData, type EncryptionInfo } from "../crypto";

export function extendedGuidToKey(id: ExtendedGUID): string {
  return id.toString();
}

/**
 * The role of a root object reference. See [MS-ONE] 2.1.8.
 */
export enum RootRole {
  DefaultContent = 1,
  MetadataRoot = 2,
  VersionMetadataRoot = 4
}

type IdMapping = Map<number, GUID>;

function resolveCompactId(
  mapping: IdMapping,
  id: CompactID
): ExtendedGUID | undefined {
  const guid = mapping.get(id.guidIndex);
  if (!guid) return undefined;
  return new ExtendedGUID(guid, id.n);
}

export type OneNoteObject = {
  contextId: string;
  jcid: JCID;
  propSet: ObjectSpaceObjectPropSet;
  mapping: Map<number, GUID>;
  fileData?: Uint8Array;
  fileDataReference?: string;
  fileExtension?: string;
  /** Object Data Container State — 0 = not encrypted, 1+ = encrypted. */
  odcs: number;
  /** When `odcs != 0`, this holds the raw encrypted property set bytes. */
  encryptedData?: Uint8Array;
};

type Revision = {
  id: string;
  parentId: string;
  role: number;
  context?: string;
  idMap: IdMapping;
  roots: Map<RootRole, string>;
  objects: Map<string, OneNoteObject>;
  encryptionRef?: { stp: number; cb: number };
};

function cloneIdMap(map: IdMapping): IdMapping {
  return new Map(map);
}

function mergeIdMap(target: IdMapping, other: IdMapping) {
  for (const [key, value] of other) target.set(key, value);
}

function walkNodes(list: FileNodeList): FileNode[] {
  const nodes: FileNode[] = [];
  for (const fragment of list.fragments) {
    for (const node of fragment.rgFileNodes) {
      if (
        node.is(FileNodeID.ChunkTerminatorFND) ||
        node.is(FileNodeID.UnknownFND)
      )
        continue;
      nodes.push(node);
    }
  }
  return nodes;
}

const ACTIVE_CONTENT_ROLE = 1;
const NIL_EXTENDED_GUID_KEY = ExtendedGUID.nil().toString();

function parseGlobalIdTable(
  nodes: FileNode[],
  index: number,
  parentMapping?: IdMapping
): { mapping: IdMapping; nextIndex: number } {
  // nodes[index] is GlobalIdTableStartFNDX or GlobalIdTableStart2FND
  let i = index + 1;
  const mapping: IdMapping = new Map();
  for (; i < nodes.length; ++i) {
    const node = nodes[i];
    if (node.is(FileNodeID.GlobalIdTableEndFNDX)) {
      return { mapping, nextIndex: i + 1 };
    } else if (node.is(FileNodeID.GlobalIdTableEntryFNDX)) {
      mapping.set(node.data.index, node.data.guid);
    } else if (node.is(FileNodeID.GlobalIdTableEntry2FNDX)) {
      const guid = parentMapping?.get(node.data.iIndexMapFrom);
      if (!guid)
        throw new Error(
          `GlobalIdTableEntry2FNDX references index ${node.data.iIndexMapFrom} that is not present in the dependency revision's global ID table.`
        );
      mapping.set(node.data.iIndexMapTo, guid);
    } else if (node.is(FileNodeID.GlobalIdTableEntry3FNDX)) {
      const { iIndexCopyFromStart, cEntriesToCopy, iIndexCopyToStart } =
        node.data;
      for (let offset = 0; offset < cEntriesToCopy; ++offset) {
        const guid = parentMapping?.get(iIndexCopyFromStart + offset);
        if (!guid)
          throw new Error(
            `GlobalIdTableEntry3FNDX references index ${
              iIndexCopyFromStart + offset
            } that is not present in the dependency revision's global ID table.`
          );
        mapping.set(iIndexCopyToStart + offset, guid);
      }
    } else {
      throw new Error(
        `Unexpected node (${FileNodeID[node.FileNodeID]}) while parsing global ID table.`
      );
    }
  }
  throw new Error("Global ID table was not terminated.");
}

function readPropertySet(
  reader: OneNoteReader,
  ref: { stp: number }
): ObjectSpaceObjectPropSet {
  reader.seek(ref.stp);
  return ObjectSpaceObjectPropSet(reader);
}

function readPropertySetAt(
  reader: OneNoteReader,
  ref: { stp: number; cb: number }
): Uint8Array {
  reader.seek(ref.stp);
  return reader.deserializeBytes(ref.cb);
}

function parseObjectDeclaration(
  node: FileNode,
  reader: OneNoteReader,
  mapping: IdMapping,
  contextId: string
): { key: string; object: OneNoteObject } | undefined {
  if (
    node.is(FileNodeID.ObjectDeclaration2RefCountFND) ||
    node.is(FileNodeID.ObjectDeclaration2LargeRefCountFND)
  ) {
    const declaration = node.data;
    const id = resolveCompactId(mapping, declaration.body.oid);
    if (!id)
      throw new Error(
        `Missing mapping for object ID (index: ${declaration.body.oid.guidIndex}).`
      );
    const odcs = declaration.body.odcs;
    if (odcs !== 0) {
      // Encrypted object — store raw data for later decryption.
      return {
        key: extendedGuidToKey(id),
        object: {
          contextId,
          jcid: declaration.body.jcid,
          propSet: emptyPropertySet(),
          mapping,
          odcs,
          encryptedData: readPropertySetAt(reader, declaration.BlobRef)
        }
      };
    }
    return {
      key: extendedGuidToKey(id),
      object: {
        contextId,
        jcid: declaration.body.jcid,
        propSet: readPropertySet(reader, declaration.BlobRef),
        mapping,
        odcs
      }
    };
  } else if (
    node.is(FileNodeID.ReadOnlyObjectDeclaration2RefCountFND) ||
    node.is(FileNodeID.ReadOnlyObjectDeclaration2LargeRefCountFND)
  ) {
    const declaration = node.data.base;
    const id = resolveCompactId(mapping, declaration.body.oid);
    if (!id)
      throw new Error(
        `Missing mapping for object ID (index: ${declaration.body.oid.guidIndex}).`
      );
    const odcs = declaration.body.odcs;
    if (odcs !== 0) {
      return {
        key: extendedGuidToKey(id),
        object: {
          contextId,
          jcid: declaration.body.jcid,
          propSet: emptyPropertySet(),
          mapping,
          odcs,
          encryptedData: readPropertySetAt(reader, declaration.BlobRef)
        }
      };
    }
    return {
      key: extendedGuidToKey(id),
      object: {
        contextId,
        jcid: declaration.body.jcid,
        propSet: readPropertySet(reader, declaration.BlobRef),
        mapping,
        odcs
      }
    };
  } else if (
    node.is(FileNodeID.ObjectDeclarationFileData3RefCountFND) ||
    node.is(FileNodeID.ObjectDeclarationFileData3LargeRefCountFND)
  ) {
    const declaration = node.data;
    const id = resolveCompactId(mapping, declaration.oid);
    if (!id)
      throw new Error(
        `Missing mapping for object ID (index: ${declaration.oid.guidIndex}).`
      );
    return {
      key: extendedGuidToKey(id),
      object: {
        contextId,
        jcid: declaration.jcid,
        propSet: emptyPropertySet(),
        mapping,
        odcs: 0,
        fileDataReference: declaration.FileDataReference.StringData,
        fileExtension: declaration.Extension.StringData
      }
    };
  } else if (
    node.is(FileNodeID.ObjectDeclarationWithRefCountFNDX) ||
    node.is(FileNodeID.ObjectDeclarationWithRefCount2FNDX)
  ) {
    const declaration = node.data;
    const id = resolveCompactId(mapping, declaration.body.oid);
    if (!id)
      throw new Error(
        `Missing mapping for object ID (index: ${declaration.body.oid.guidIndex}).`
      );
    return {
      key: extendedGuidToKey(id),
      object: {
        contextId,
        jcid: jcidFromId(declaration.body.jci | 0x20000),
        propSet: readPropertySet(reader, declaration.ObjectRef),
        mapping,
        odcs: 0
      }
    };
  }
  return undefined;
}

function jcidFromId(id: number): JCID {
  return {
    id,
    index: id & 0xffff,
    isBinary: ((id >> 16) & 0x1) === 1,
    isPropertySet: ((id >> 17) & 0x1) === 1,
    isGraphNode: ((id >> 18) & 0x1) === 1,
    isFileData: ((id >> 19) & 0x1) === 1,
    isReadOnly: ((id >> 20) & 0x1) === 1
  };
}

function emptyPropertySet(): ObjectSpaceObjectPropSet {
  return {
    OIDs: {
      header: {
        count: 0,
        ExtendedStreamsPresent: false,
        OsidStreamNotPresent: false
      },
      body: []
    },
    body: { cProperties: 0, rgData: [], rgPrids: [] }
  };
}

function parseRevision(
  nodes: FileNode[],
  index: number,
  reader: OneNoteReader,
  revisions: Map<string, Revision>,
  contextId: string
): { revision: Revision; nextIndex: number } {
  const start = nodes[index];
  let id: ExtendedGUID;
  let parentId: ExtendedGUID;
  let role: number;
  let context: string | undefined;

  if (start.is(FileNodeID.RevisionManifestStart4FND)) {
    id = start.data.rid;
    parentId = start.data.ridDependent;
    role = start.data.revisionRole;
    context = undefined;
  } else if (start.is(FileNodeID.RevisionManifestStart6FND)) {
    id = start.data.rid;
    parentId = start.data.ridDependent;
    role = start.data.revisionRole;
    context = undefined;
  } else if (start.is(FileNodeID.RevisionManifestStart7FND)) {
    id = start.data.base.rid;
    parentId = start.data.base.ridDependent;
    role = start.data.base.revisionRole;
    context = extendedGuidToKey(start.data.gctxid);
  } else {
    throw new Error(
      `Invalid start node for revision: ${FileNodeID[start.FileNodeID]}`
    );
  }

  const parent = revisions.get(extendedGuidToKey(parentId));
  const idMap = parent ? cloneIdMap(parent.idMap) : new Map<number, GUID>();
  const roots = new Map<RootRole, string>();
  const objects = new Map<string, OneNoteObject>();
  let lastGlobalIdTable: IdMapping | undefined;
  let encryptionRef: { stp: number; cb: number } | undefined;

  let i = index + 1;
  for (; i < nodes.length; ++i) {
    const node = nodes[i];
    if (node.is(FileNodeID.RevisionManifestEndFND)) {
      return {
        revision: {
          id: extendedGuidToKey(id),
          parentId: extendedGuidToKey(parentId),
          role,
          context,
          idMap,
          roots,
          objects,
          encryptionRef
        },
        nextIndex: i + 1
      };
    } else if (node.is(FileNodeID.ObjectGroupListReferenceFND)) {
      parseObjectGroupList(node.children[0], reader, idMap, contextId, objects);
    } else if (
      node.is(FileNodeID.GlobalIdTableStartFNDX) ||
      node.is(FileNodeID.GlobalIdTableStart2FND)
    ) {
      const parsed = parseGlobalIdTable(nodes, i, parent?.idMap);
      lastGlobalIdTable = parsed.mapping;
      mergeIdMap(idMap, parsed.mapping);
      i = parsed.nextIndex - 1;
    } else if (
      node.is(FileNodeID.ObjectDeclaration2RefCountFND) ||
      node.is(FileNodeID.ObjectDeclaration2LargeRefCountFND) ||
      node.is(FileNodeID.ReadOnlyObjectDeclaration2RefCountFND) ||
      node.is(FileNodeID.ReadOnlyObjectDeclaration2LargeRefCountFND) ||
      node.is(FileNodeID.ObjectDeclarationFileData3RefCountFND) ||
      node.is(FileNodeID.ObjectDeclarationFileData3LargeRefCountFND) ||
      node.is(FileNodeID.ObjectDeclarationWithRefCountFNDX) ||
      node.is(FileNodeID.ObjectDeclarationWithRefCount2FNDX)
    ) {
      // In .onetoc2 files, objects can directly follow GlobalIdTables.
      if (!lastGlobalIdTable)
        throw new Error("Object declaration without a global ID table.");
      const parsed = parseObjectDeclaration(
        node,
        reader,
        lastGlobalIdTable,
        contextId
      );
      if (parsed) objects.set(parsed.key, parsed.object);
      else throw new Error("Unexpected object declaration node.");
    } else if (
      node.is(FileNodeID.ObjectRevisionWithRefCountFNDX) ||
      node.is(FileNodeID.ObjectRevisionWithRefCount2FNDX)
    ) {
      // Reference counting does not affect the materialized object state.
    } else if (node.is(FileNodeID.RootObjectReference2FNDX)) {
      if (!lastGlobalIdTable)
        throw new Error(
          "Unable to resolve RootObjectReference2FNDX ID: no global ID table found."
        );
      const id = resolveCompactId(lastGlobalIdTable, node.data.oidRoot);
      if (!id)
        throw new Error(
          `Missing mapping for root object (index: ${node.data.oidRoot.guidIndex}).`
        );
      roots.set(node.data.RootRole as RootRole, extendedGuidToKey(id));
    } else if (node.is(FileNodeID.RootObjectReference3FND)) {
      roots.set(
        node.data.RootRole as RootRole,
        extendedGuidToKey(node.data.oidRoot)
      );
    } else if (
      node.is(FileNodeID.DataSignatureGroupDefinitionFND) ||
      node.is(FileNodeID.ObjectInfoDependencyOverridesFND) ||
      FileNodeID[node.FileNodeID] === undefined
    ) {
      // Ignored (unknown node types can appear in newer files).
    } else if (
      node.is(FileNodeID.ObjectDataEncryptionKeyV2FNDX)
    ) {
      // Store the ref to the encryption blob. The blob contains:
      // 8-byte header magic, then encryption XML (UTF-16LE), then 8-byte footer magic.
      encryptionRef = {
        stp: node.data.ref.stp,
        cb: node.data.ref.cb
      };
    } else {
      throw new Error(
        `Unexpected node (0x${node.FileNodeID.toString(16)}) while parsing revision.`
      );
    }
  }
  throw new Error("Revision was not terminated.");
}

function parseObjectGroupList(
  list: FileNodeList,
  reader: OneNoteReader,
  idMap: IdMapping,
  contextId: string,
  objects: Map<string, OneNoteObject>
) {
  const nodes = walkNodes(list);
  if (!nodes[0] || !nodes[0].is(FileNodeID.ObjectGroupStartFND)) {
    throw new Error(
      "Object group lists must start with an ObjectGroupStartFND node."
    );
  }
  let i = 1;

  // Object groups only occur in .one files whose global ID tables never use
  // dependency revision references, so no parent table is needed.
  if (
    nodes[i] &&
    (nodes[i].is(FileNodeID.GlobalIdTableStartFNDX) ||
      nodes[i].is(FileNodeID.GlobalIdTableStart2FND))
  ) {
    const parsed = parseGlobalIdTable(nodes, i);
    i = parsed.nextIndex;
    idMap = parsed.mapping;
  }

  for (; i < nodes.length; ++i) {
    const node = nodes[i];
    if (node.is(FileNodeID.ObjectGroupEndFND)) break;
    if (node.is(FileNodeID.DataSignatureGroupDefinitionFND)) continue;
    const parsed = parseObjectDeclaration(node, reader, idMap, contextId);
    if (parsed) {
      objects.set(parsed.key, parsed.object);
    } else {
      throw new Error(
        `Unexpected node in ObjectGroupList: ${FileNodeID[node.FileNodeID]}`
      );
    }
  }
}

export class ObjectSpace {
  readonly id: string;
  readonly encryptionXml: string | undefined;
  private readonly roots: Map<RootRole, string>;
  private readonly objects: Map<string, OneNoteObject>;

  constructor(
    id: string,
    roots: Map<RootRole, string>,
    objects: Map<string, OneNoteObject>,
    encryptionXml?: string
  ) {
    this.id = id;
    this.roots = roots;
    this.objects = objects;
    this.encryptionXml = encryptionXml;
  }

  /** Whether this object space is encrypted (password-protected). */
  get isEncrypted(): boolean {
    return this.encryptionXml !== undefined;
  }

  /** Decrypt all encrypted objects in this space using the given data key. */
  async decryptObjects(dataKey: Uint8Array, reader: OneNoteReader) {
    const encryptedObjects = [...this.objects.entries()].filter(
      ([, obj]) => obj.odcs !== 0 && obj.encryptedData
    );
    if (encryptedObjects.length === 0) return;

    for (const [key, obj] of encryptedObjects) {
      try {
        const decrypted = await decryptObjectData(obj.encryptedData!, dataKey);
        const tempReader = new (reader.constructor as new (
          buf: Uint8Array
        ) => OneNoteReader)(decrypted);
        obj.propSet = ObjectSpaceObjectPropSet(tempReader);
        obj.encryptedData = undefined;
      } catch (e) {
        console.warn(`Failed to decrypt object ${key}:`, e);
      }
    }
  }

  getObject(id: string): OneNoteObject | undefined {
    return this.objects.get(id);
  }

  contentRoot(): string | undefined {
    return this.roots.get(RootRole.DefaultContent);
  }

  metadataRoot(): string | undefined {
    return this.roots.get(RootRole.MetadataRoot);
  }
}

/**
 * Provides access to all object spaces contained in a OneStore file and
 * mirrors the `OneStore` API of the Rust onenote_parser crate.
 */
export class ObjectSpaceStore {
  readonly objectSpaces = new Map<string, ObjectSpace>();
  readonly rootObjectSpaceId: string;
  readonly fileDataStore = new Map<string, Uint8Array>();

  private constructor(
    objectSpaces: Map<string, ObjectSpace>,
    rootObjectSpaceId: string,
    fileDataStore: Map<string, Uint8Array>
  ) {
    this.objectSpaces = objectSpaces;
    this.rootObjectSpaceId = rootObjectSpaceId;
    this.fileDataStore = fileDataStore;
  }

  get dataRoot(): ObjectSpace {
    const space = this.objectSpaces.get(this.rootObjectSpaceId);
    if (!space) throw new Error("Root object space is missing.");
    return space;
  }

  objectSpace(id: string): ObjectSpace | undefined {
    return this.objectSpaces.get(id);
  }

  static parse(store: OneStore): ObjectSpaceStore {
    const reader = store.reader;
    const fileDataStore = new Map<string, Uint8Array>();
    const objectSpaces = new Map<string, ObjectSpace>();
    let rootObjectSpaceId: string | undefined;

    const nodes = walkNodes(store.fileNodeList);

    for (const node of nodes) {
      if (node.is(FileNodeID.FileDataStoreListReferenceFND)) {
        parseFileDataStore(node, reader, fileDataStore);
      }
    }

    for (const node of nodes) {
      if (node.is(FileNodeID.ObjectSpaceManifestListReferenceFND)) {
        const space = parseObjectSpace(node, reader, fileDataStore);
        objectSpaces.set(space.id, space);
      } else if (node.is(FileNodeID.ObjectSpaceManifestRootFND)) {
        rootObjectSpaceId = extendedGuidToKey(node.data.gosidRoot);
      }
    }

    if (!rootObjectSpaceId) {
      throw new Error(
        "Root file node list did not contain a node with the root ID."
      );
    }
    if (!objectSpaces.has(rootObjectSpaceId)) {
      throw new Error("Root object space is missing.");
    }

    return new ObjectSpaceStore(objectSpaces, rootObjectSpaceId, fileDataStore);
  }
}

function parseFileDataStore(
  node: FileNode,
  reader: OneNoteReader,
  fileDataStore: Map<string, Uint8Array>
) {
  for (const list of node.children) {
    for (const item of walkNodes(list)) {
      if (!item.is(FileNodeID.FileDataStoreObjectReferenceFND)) {
        throw new Error(
          `Unexpected item in file list: ${FileNodeID[item.FileNodeID]}. Expected FileDataStoreObjectReferenceFND.`
        );
      }
      reader.seek(item.data.ref.stp);
      const guidHeader = reader.deserializeGUID();
      const cbLength = reader.deserializeLong();
      reader.deserializeBytes(4);
      reader.deserializeBytes(8);
      const fileData = reader.deserializeBytes(cbLength);
      fileDataStore.set(item.data.guidReference.toString(), fileData);
      void guidHeader;
    }
  }
}

function parseObjectSpace(
  listReference: FileNode,
  reader: OneNoteReader,
  fileDataByGuid: Map<string, Uint8Array>
): ObjectSpace {
  if (!listReference.is(FileNodeID.ObjectSpaceManifestListReferenceFND))
    throw new Error("Expected an ObjectSpaceManifestListReferenceFND.");
  const gosid = extendedGuidToKey(listReference.data.gosid);
  const contextId = gosid;

  // The object space manifest list contains an ObjectSpaceManifestListStartFND
  // followed by one or more RevisionManifestListReferenceFNDs. All but the last
  // revision must be ignored.
  const manifestNodes = walkNodes(listReference.children[0]);
  let lastRevisionList: FileNode | undefined;
  for (const node of manifestNodes) {
    if (node.is(FileNodeID.RevisionManifestListReferenceFND))
      lastRevisionList = node;
  }
  if (!lastRevisionList) {
    throw new Error(
      "ObjectSpaceManifestListReferenceFND must point to a list with at least one revision."
    );
  }

  const nodes = walkNodes(lastRevisionList.children[0]);

  const revisions = new Map<string, Revision>();
  const labels = new Map<string, string>();

  let i = 0;
  while (i < nodes.length) {
    const node = nodes[i];
    if (node.is(FileNodeID.RevisionManifestEndFND)) {
      i += 1;
      break;
    } else if (node.is(FileNodeID.RevisionManifestListStartFND)) {
      i += 1;
    } else if (node.is(FileNodeID.RevisionRoleDeclarationFND)) {
      const revisionId = extendedGuidToKey(node.data.rid);
      if (!revisions.has(revisionId)) {
        throw new Error(
          "Revision role declaration points to an undeclared revision."
        );
      }
      labels.set(labelKey(undefined, node.data.RevisionRole), revisionId);
      i += 1;
    } else if (node.is(FileNodeID.RevisionRoleAndContextDeclarationFND)) {
      const revisionId = extendedGuidToKey(node.data.base.rid);
      if (!revisions.has(revisionId)) {
        throw new Error(
          "Revision role declaration points to an undeclared revision."
        );
      }
      labels.set(
        labelKey(
          extendedGuidToKey(node.data.gctxid),
          node.data.base.RevisionRole
        ),
        revisionId
      );
      i += 1;
    } else if (
      node.is(FileNodeID.RevisionManifestStart4FND) ||
      node.is(FileNodeID.RevisionManifestStart6FND) ||
      node.is(FileNodeID.RevisionManifestStart7FND)
    ) {
      const parsed = parseRevision(nodes, i, reader, revisions, contextId);
      labels.set(
        labelKey(parsed.revision.context, parsed.revision.role),
        parsed.revision.id
      );
      revisions.set(parsed.revision.id, parsed.revision);
      i = parsed.nextIndex;
    } else {
      throw new Error(
        `Unexpected node encountered in RevisionManifestList: ${
          FileNodeID[node.FileNodeID]
        }`
      );
    }
  }

  const activeId = labels.get(labelKey(undefined, ACTIVE_CONTENT_ROLE));
  if (!activeId) {
    throw new Error(
      "Revision manifest list has no active revision in the default context."
    );
  }

  // Materialize the active revision's dependency chain.
  const roots = new Map<RootRole, string>();
  const objects = new Map<string, OneNoteObject>();
  const chain: Revision[] = [];
  let revisionId: string | undefined = activeId;
  while (revisionId) {
    const revision = revisions.get(revisionId);
    if (!revision)
      throw new Error(
        `Revision chain points to undeclared revision ${revisionId}.`
      );
    chain.push(revision);
    revisionId =
      revision.parentId === NIL_EXTENDED_GUID_KEY
        ? undefined
        : revision.parentId;
  }

  let encryptionRef: { stp: number; cb: number } | undefined;

  for (const revision of chain.reverse()) {
    for (const [role, id] of revision.roots) roots.set(role, id);
    for (const [id, object] of revision.objects) objects.set(id, object);
    if (revision.encryptionRef && !encryptionRef) {
      encryptionRef = revision.encryptionRef;
    }
  }

  // If the object space is encrypted, read the encryption XML blob.
  let encryptionXml: string | undefined;
  if (encryptionRef) {
    reader.seek(encryptionRef.stp);
    const blob = reader.deserializeBytes(encryptionRef.cb);
    // The blob has: 8-byte header magic (0xFB6BA385DAD1A067),
    // then UTF-16LE XML, then 8-byte footer magic (0x2649294F8E198B3C).
    // Skip the 8-byte header and 8-byte footer.
    if (blob.length > 16) {
      const xmlBytes = blob.slice(8, blob.length - 8);
      encryptionXml = decode(xmlBytes, "utf16le");
    }
  }

  // Resolve file data references.
  for (const object of objects.values()) {
    if (object.fileDataReference) {
      if (object.fileDataReference.startsWith("<ifndf>")) {
        let guid = object.fileDataReference.slice("<ifndf>".length);
        // Strip curly braces if present — the file data store keys
        // don't include them but the references may.
        if (guid.startsWith("{") && guid.endsWith("}")) {
          guid = guid.slice(1, -1);
        }
        object.fileData = fileDataByGuid.get(guid);
      }
    }
  }

  return new ObjectSpace(gosid, roots, objects, encryptionXml);
}

function labelKey(context: string | undefined, role: number): string {
  return `${context ?? ""}:${role}`;
}
