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

import { ContentType, Note } from "../../models/note";
import { SimplenoteNote } from "./types";
import {
  IFileProvider,
  ProviderErrorMessage,
  ProviderMessage,
  ProviderSettings,
  error
} from "../provider";
import { File } from "../../utils/file";
import { markdowntoHTML, textToHTML } from "../../utils/to-html";
import { JSONParser } from "@streamparser/json";
import { Providers } from "../provider-factory";

export class Simplenote implements IFileProvider {
  id: Providers = "simplenote";
  type = "file" as const;
  supportedExtensions = [".zip"];
  version = "1.0.0";
  name = "Simplenote";
  examples = ["notes.zip"];
  helpLink =
    "https://help.notesnook.com/importing-notes/import-notes-from-simplenote";

  filter(file: File) {
    return [".json"].includes(file.extension);
  }

  async *process(
    file: File,
    _settings: ProviderSettings,
    _files: File[]
  ): AsyncGenerator<ProviderMessage, void, unknown> {
    const parser = new JSONParser({
      stringBufferSize: undefined,
      paths: ["$.activeNotes.*"]
    });

    const notes: Note[] = [];
    const errors: ProviderErrorMessage[] = [];
    parser.onValue = (value, key, parent, stack) => {
      if (stack.length === 1) return;
      // By default, the parser keeps all the child elements in memory until the root parent is emitted.
      // Let's delete the objects after processing them in order to optimize memory.
      if (parent && key) delete (parent as any)[key];

      const activeNote = value as SimplenoteNote;
      if (!activeNote.creationDate || !activeNote.lastModified) {
        errors.push(
          error(
            new Error(
              `Invalid note. creationDate & lastModified properties are required.`
            ),
            { file }
          )
        );
        return;
      }

      const lines = (activeNote.content || "").split(/\r\n|\n/);
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

      for (const error of errors) {
        yield error;
      }

      for (const note of notes) {
        yield { type: "note", note };
      }

      errors.length = 0;
      notes.length = 0;
    }
  }
}
