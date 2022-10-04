/*
This file is part of the Notesnook project (https://notesnook.com/)

Copyright (C) 2022 Streetwriters (Private) Limited

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

import { zipSync, unzipSync, Unzipped } from "fflate";
import { path } from "./path";
import { Note } from "../models/note";
import { File, IFile } from "./file";
import SparkMD5 from "spark-md5";
import { Tar, TarFile } from "./tar";

const metadataFilename = "metadata.json";
const noteDataFilename = "note.json";
const attachmentsDirectory = "attachments";
const md5 = new SparkMD5.ArrayBuffer();
const textEncoder = new TextEncoder();

type PackageMetadata = {
  version: string;
  notes: string[];
};

type NoteFiles = {
  files: Record<string, Uint8Array>;
  hash: string;
};

type Unpacker = (file: IFile) => IFile[];

const unpackers: Record<string, Unpacker> = {
  ".zip": unzip,
  ".jex": untar,
  ".znote": untar,
};

function isArchive(file: IFile) {
  for (const unpacker in unpackers) {
    if (file.name.endsWith(unpacker)) return true;
  }
  return false;
}

export function unpack(files: IFile[], root?: string): File[] {
  const extracted: File[] = [];

  for (const file of files) {
    if (file.path && root) file.path = path.join(root, file.path);
    extracted.push(new File(file));

    if (isArchive(file)) {
      try {
        const root = path.basename(file.name, "");
        const unpacker = unpackers[path.extname(file.name)];
        extracted.push(...unpack(unpacker(file), root));
      } catch (e) {
        console.error(e);
        continue;
      }
    }
  }

  return extracted;
}

export function pack(notes: Note[]): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  const metadata: PackageMetadata = {
    version: "1.0.0",
    notes: [],
  };

  for (const note of notes) {
    const { files: noteFiles, hash } = filefy(note);
    for (const key in noteFiles) {
      const filePath = path.join(hash, key);
      files[filePath] = noteFiles[key];
    }
    metadata.notes.push(hash);
  }
  files[metadataFilename] = textEncoder.encode(JSON.stringify(metadata));
  return zipSync(files, { level: 9, mem: 12 });
}

function filefy(note: Note): NoteFiles {
  const files: Record<string, Uint8Array> = {};

  if (note.attachments) {
    for (const attachment of note.attachments) {
      if (!attachment.data) continue;
      const filePath = path.join(attachmentsDirectory, attachment.hash);
      files[filePath] = attachment.data;
      attachment.data = undefined;
    }
  }

  const noteData = textEncoder.encode(JSON.stringify(note));
  const noteDataHash = md5.append(noteData).end();
  files[noteDataFilename] = noteData;
  return { files, hash: noteDataHash };
}

function unzip(file: IFile): IFile[] {
  const extracted: IFile[] = [];
  let entries: Unzipped = {};
  if (file.data instanceof Uint8Array || file.data instanceof Buffer) {
    entries = unzipSync(file.data);
  } else if (file.data instanceof ArrayBuffer) {
    entries = unzipSync(new Uint8Array(file.data));
  }

  for (const entry in entries) {
    const data = entries[entry];
    if (!data || data.length <= 0) continue;
    extracted.push({
      data,
      name: path.basename(entry),
      path: entry,
      parent: file,
    });
  }

  return extracted;
}

function untar(file: IFile): IFile[] {
  const extracted: IFile[] = [];
  let entries: Map<string, TarFile> | undefined;
  if (file.data instanceof Uint8Array || file.data instanceof Buffer) {
    entries = Tar.fromUint8Array(file.data).files;
  } else if (file.data instanceof ArrayBuffer) {
    entries = Tar.fromUint8Array(new Uint8Array(file.data)).files;
  }

  if (!entries) return extracted;

  for (const [filePath, tarFile] of entries?.entries()) {
    extracted.push({
      data: tarFile.read(),
      name: tarFile.header.name,
      path: filePath,
      parent: file,
    });
  }

  return extracted;
}
