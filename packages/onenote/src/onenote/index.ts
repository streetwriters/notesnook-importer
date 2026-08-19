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

import { OneStore } from "../onestore";
import { OneStoreFileType } from "../onestore/header";
import { ObjectSpaceStore } from "../onestore/object-space";
import { GUID } from "../utils/guid";
import { FileNodeID } from "../onestore/file-node-types";
import { parseNotebookToc, parseSection } from "./parse";
import {
  parseEncryptionXml,
  verifyPassword,
  decryptDataKey
} from "../crypto";
import type { Color, Notebook, Section, SectionEntry } from "./types";

export { parseNotebookToc };

export * from "./types";

export type OneNoteFileType = "section" | "notebook" | "unknown";

/**
 * Thrown when a section is encrypted and cannot be imported without a password.
 */
export class OneNoteEncryptedError extends Error {
  constructor(
    public readonly filename: string,
    public readonly encryptionXml: string,
    message?: string
  ) {
    super(
      message ||
        `The section "${filename}" is password-protected. Provide the password to import it.`
    );
    this.name = "OneNoteEncryptedError";
  }
}

const SECTION_FILE_TYPE_GUID = "7B5C52E4-D88C-4DA7-AEB1-5378D02996D3";
const TOC_FILE_TYPE_GUID = "43FF2FA1-EFD9-4C76-9EE2-10EA5722765F";

/**
 * Sniffs the type of a OneNote file by reading the file type GUID from the
 * file header without fully parsing it.
 */
export function sniffOneNoteFileType(data: Uint8Array): OneNoteFileType {
  try {
    if (data.length < 64) return "unknown";
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    // The file type GUID is the first GUID in the OneStore header.
    const guid = GUID.fromBuffer(new Uint8Array(data.slice(0, 16)));
    const fileType = guid.toString();
    if (fileType === SECTION_FILE_TYPE_GUID) return "section";
    if (fileType === TOC_FILE_TYPE_GUID) return "notebook";
    return "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Parses a single OneNote section (.one) file.
 *
 * @param data the raw bytes of the .one file
 * @param filename the name of the file, used as fallback for the display name
 * @param password optional password for encrypted sections
 */
export async function parseOneNoteSection(
  data: Uint8Array,
  filename: string,
  password?: string
): Promise<Section> {
  const store = new OneStore(data);
  if (store.header.fileType !== OneStoreFileType.STORE) {
    throw new Error(`Not a valid .one file: ${filename}`);
  }

  // Pre-check: scan the root file node list for encryption markers. If
  // the file is encrypted and no password was provided, fail early rather
  // than letting the parser crash on garbage property set data.
  const hasEncryption = containsEncryptionMarker(store);
  if (hasEncryption && !password) {
    throw new OneNoteEncryptedError(filename, "");
  }

  const spaceStore = ObjectSpaceStore.parse(store);

  // Handle encryption: decrypt the root object space if a password is provided.
  const rootSpace = spaceStore.dataRoot;
  if (rootSpace.isEncrypted) {
    if (!password) {
      throw new OneNoteEncryptedError(filename, rootSpace.encryptionXml!);
    }
    const encryptionInfo = parseEncryptionXml(rootSpace.encryptionXml!);
    const valid = await verifyPassword(password, encryptionInfo);
    if (!valid) {
      throw new OneNoteEncryptedError(
        filename,
        rootSpace.encryptionXml!,
        "Incorrect password."
      );
    }
    const dataKey = await decryptDataKey(password, encryptionInfo);
    await rootSpace.decryptObjects(dataKey, store.reader);
  }

  return parseSection(spaceStore, filename);
}

/**
 * Scans the entire file node tree for ObjectDataEncryptionKeyV2FNDX markers
 * without fully parsing the object space. This is used as a cheap pre-check
 * to detect encrypted files before the parser encounters garbage data.
 */
function containsEncryptionMarker(store: OneStore): boolean {
  return walkForEncryption(store.fileNodeList);
}

function walkForEncryption(list: {
  fragments: { rgFileNodes: { FileNodeID: number; children: any[] }[] }[];
}): boolean {
  for (const fragment of list.fragments) {
    for (const node of fragment.rgFileNodes) {
      if (node.FileNodeID === FileNodeID.ObjectDataEncryptionKeyV2FNDX)
        return true;
      for (const child of node.children) {
        if (walkForEncryption(child)) return true;
      }
    }
  }
  return false;
}

export type ResolveFile = (name: string) => Uint8Array | undefined;

/**
 * Parses the table of contents of a OneNote notebook (.onetoc2) file.
 * Returns the section/group entry names in the order they appear in the
 * notebook along with the notebook's color.
 */
export function parseOneNoteNotebookToc(data: Uint8Array): {
  entries: string[];
  color?: { alpha: number; r: number; g: number; b: number };
} {
  const store = new OneStore(data);
  if (store.header.fileType !== OneStoreFileType.TABLE_OF_CONTENTS) {
    throw new Error("Not a valid .onetoc2 file");
  }
  const spaceStore = ObjectSpaceStore.parse(store);
  return parseNotebookToc(spaceStore.dataRoot);
}

/**
 * Parses a OneNote notebook table of contents (.onetoc2) file.
 *
 * @param data the raw bytes of the .onetoc2 file
 * @param resolveFile a function that resolves the bytes of a section file by
 * its (sanitized) name; returns undefined when a file cannot be resolved in
 * which case the entry is skipped
 */
export async function parseOneNoteNotebook(
  data: Uint8Array,
  resolveFile: ResolveFile,
  password?: string
): Promise<Notebook> {
  const store = new OneStore(data);
  if (store.header.fileType !== OneStoreFileType.TABLE_OF_CONTENTS) {
    throw new Error("Not a valid .onetoc2 file");
  }
  const spaceStore = ObjectSpaceStore.parse(store);
  const { entries, color } = parseNotebookToc(spaceStore.dataRoot);

  const sections: SectionEntry[] = [];
  for (const name of entries) {
    const sectionData = resolveFile(name);
    if (!sectionData) continue;
    try {
      sections.push({
        type: "section",
        section: await parseOneNoteSection(sectionData, name, password)
      });
    } catch (e) {
      // A single bad section shouldn't take down the whole notebook.
      console.warn(`failed to import section ${name}:`, e);
    }
  }

  return { entries: sections, color };
}
