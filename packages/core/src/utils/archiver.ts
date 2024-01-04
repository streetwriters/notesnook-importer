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

import { path } from "./path";
import { Note } from "../models/note";
import { File, IFile } from "./file";
import { Tar, TarFile } from "./tar";
import { IStorage } from "@notesnook-importer/storage";
import { unzip } from "./unzip-stream";
import { NoteStream } from "./note-stream";
import { createZipStream } from "./zip-stream";

type Unpacker = (file: IFile) => IFile[] | Promise<IFile[]>;

const unpackers: Record<string, Unpacker> = {
  ".zip": unzip,
  ".jex": untar,
  ".znote": untar,
  ".textpack": unzip
};

function isArchive(file: IFile) {
  for (const unpacker in unpackers) {
    if (file.name.endsWith(unpacker)) return true;
  }
  return false;
}

export async function unpack(files: IFile[], root?: string): Promise<File[]> {
  const extracted: File[] = [];
  for (const file of files) {
    if (file.path && root) file.path = path.join(root, file.path);
    extracted.push(new File(file));

    if (isArchive(file)) {
      try {
        const root = path.basename(file.name, "");
        const unpacker = unpackers[path.extname(file.name)];
        extracted.push(...(await unpack(await unpacker(file), root)));
      } catch (e) {
        console.error(e);
        continue;
      }
    }
  }
  return extracted;
}

export function pack(
  storage: IStorage<Note>,
  report: (done: number) => void = () => {}
) {
  return new NoteStream(storage, report).pipeThrough(createZipStream());
}

async function untar(file: IFile): Promise<IFile[]> {
  const extracted: IFile[] = [];
  const data = await new File(file).bytes();
  if (!data) return extracted;

  const entries: Map<string, TarFile> = Tar.fromUint8Array(data).files;

  for (const [filePath, tarFile] of entries?.entries() || []) {
    extracted.push({
      data: new Blob([tarFile.read()]),
      name: tarFile.header.name,
      size: tarFile.header.size,
      path: filePath,
      parent: file
    });
  }

  return extracted;
}
