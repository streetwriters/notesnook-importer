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

import { parse, processContent } from "@notesnook-importer/enex";
import { IFileProvider, ProviderSettings } from "../provider";
import { ContentType, Note, Notebook } from "../../models/note";
import { ElementHandler } from "./element-handlers";
import { File } from "../../utils/file";

export class Evernote implements IFileProvider {
  public type = "file" as const;
  public supportedExtensions = [".enex"];
  public examples = ["First Notebook.enex", "checklist.enex"];
  public version = "1.0.0";
  public name = "Evernote";

  filter(file: File) {
    return this.supportedExtensions.includes(file.extension);
  }

  async *process(file: File, settings: ProviderSettings) {
    const notebook: Notebook = {
      notebook: file.nameWithoutExtension
    };

    for await (const chunk of parse(
      file.stream.pipeThrough(new TextDecoderStream())
    )) {
      for (const enNote of chunk) {
        const note: Note = {
          title: enNote.title || "",
          tags: enNote.tags,
          dateCreated: enNote.created?.getTime(),
          dateEdited: enNote.updated?.getTime(),
          attachments: [],
          notebooks: [notebook]
        };
        if (enNote.content) {
          const elementHandler = new ElementHandler(
            note,
            enNote,
            settings.hasher
          );

          const html = await processContent(enNote.content, elementHandler);
          note.content = {
            data: html,
            type: ContentType.HTML
          };
        }

        yield note;
      }
    }
  }
}
