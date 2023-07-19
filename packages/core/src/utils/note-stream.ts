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

import { IStorage } from "@notesnook-importer/storage";
import SparkMD5 from "spark-md5";
import { Note } from "../models";
import { path } from "./path";
import { ZipFile } from "./zip-stream";

export const NOTE_DATA_FILENAME = "note.json";
export const METADATA_FILENAME = "metadata.json";
export const ATTACHMENTS_DIRECTORY_NAME = "attachments";

export type NoteFiles = {
  files: Record<string, Uint8Array>;
  hash: string;
};
export type PackageMetadata = {
  version: string;
  notes: string[];
};

export class NoteStream extends ReadableStream<ZipFile> {
  constructor(storage: IStorage<Note>, report: (done: number) => void) {
    const notes = storage.iterate();
    const metadata: PackageMetadata = {
      version: "1.0.0",
      notes: []
    };

    super({
      async pull(controller) {
        const { value: note, done } = await notes.next();
        if (done) {
          controller.enqueue({
            path: METADATA_FILENAME,
            data: new TextEncoder().encode(JSON.stringify(metadata))
          });
          await storage.clear();
          return controller.close();
        }

        const { files, hash } = filefy(note);
        for (const key in files) {
          const filePath = `${hash}/${key}`;
          controller.enqueue({
            path: filePath,
            data: files[key]
          });
        }
        metadata.notes.push(hash);
        report(metadata.notes.length);
      }
    });
  }
}

function filefy(note: Note): NoteFiles {
  const files: Record<string, Uint8Array> = {};

  if (note.attachments) {
    for (const attachment of note.attachments) {
      if (!attachment.data) continue;
      const filePath = path.join(ATTACHMENTS_DIRECTORY_NAME, attachment.hash);
      files[filePath] = attachment.data;
      attachment.data = undefined;
    }
  }

  const noteData = new TextEncoder().encode(JSON.stringify(note));
  const noteDataHash = new SparkMD5.ArrayBuffer().append(noteData).end();
  files[NOTE_DATA_FILENAME] = noteData;
  return { files, hash: noteDataHash };
}
