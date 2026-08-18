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
import { parseNotebookToc, parseSection } from "./parse";

export { parseNotebookToc };
import { Notebook, Section, SectionEntry } from "./types";

export * from "./types";

export type OneNoteFileType = "section" | "notebook" | "unknown";

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
 */
export function parseOneNoteSection(data: Uint8Array, filename: string): Section {
  const store = new OneStore(data);
  if (store.header.fileType !== OneStoreFileType.STORE) {
    throw new Error(`Not a valid .one file: ${filename}`);
  }
  const spaceStore = ObjectSpaceStore.parse(store);
  return parseSection(spaceStore, filename);
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
export function parseOneNoteNotebook(
  data: Uint8Array,
  resolveFile: ResolveFile
): Notebook {
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
        section: parseOneNoteSection(sectionData, name)
      });
    } catch (e) {
      // A single bad section shouldn't take down the whole notebook.
      console.warn(`failed to import section ${name}:`, e);
    }
  }

  return { entries: sections, color };
}
