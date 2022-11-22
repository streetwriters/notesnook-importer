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

import { ContentType, Note } from "../../models/note";
import { SimplenoteNote } from "./types";
import { IFileProvider, ProviderSettings } from "../provider";
import { File } from "../../utils/file";
import { markdowntoHTML, textToHTML } from "../../utils/to-html";
import { JSONParser } from "@streamparser/json";

export class Simplenote implements IFileProvider {
  public type = "file" as const;
  public supportedExtensions = [".zip"];
  public version = "1.0.0";
  public name = "Simplenote";
  public examples = ["notes.zip"];

  filter(file: File) {
    return [".json"].includes(file.extension);
  }

  async *process(file: File, _settings: ProviderSettings, _files: File[]) {
    const parser = new JSONParser({
      stringBufferSize: undefined,
      paths: ["$.activeNotes.*"]
    });

    const notes: Note[] = [];
    parser.onValue = (value, key, parent, stack) => {
      if (stack.length === 1) return;
      // By default, the parser keeps all the child elements in memory until the root parent is emitted.
      // Let's delete the objects after processing them in order to optimize memory.
      if (parent && key) delete (parent as any)[key];

      const activeNote = value as SimplenoteNote;
      if (
        !activeNote.content ||
        !activeNote.creationDate ||
        !activeNote.lastModified
      ) {
        throw new Error(
          `Invalid note. content, creationDate & lastModified properties are required. (File: ${file.name})`
        );
      }

      const lines = activeNote.content.split(/\r\n|\n/);
      const title = lines[0];
      const content = activeNote.markdown
        ? markdowntoHTML(lines.join("\n"))
        : textToHTML(lines.join("\n"));

      const note: Note = {
        title: title || "Untitled note",
        dateCreated: new Date(activeNote.creationDate).getTime(),
        dateEdited: new Date(activeNote.lastModified).getTime(),
        pinned: activeNote.pinned,
        tags: activeNote.tags,
        content: {
          type: ContentType.HTML,
          data: content
        }
      };
      notes.push(note);
    };

    const reader = file.stream.pipeThrough(new TextDecoderStream()).getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      parser.write(value);

      for (const note of notes) {
        yield note;
      }
      notes.length = 0;
    }
  }
}
