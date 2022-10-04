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

import { Enex } from "@notesnook-importer/enex";
import {
  IFileProvider,
  iterate,
  ProviderResult,
  ProviderSettings
} from "../provider";
import { ContentType, Note, Notebook } from "../../models/note";
import { ElementHandler } from "./element-handlers";
import { File } from "../../utils/file";
import { path } from "../../utils/path";

export class Evernote implements IFileProvider {
  type: "file" = "file";
  public supportedExtensions = [".enex"];
  public validExtensions = [...this.supportedExtensions];
  public version = "1.0.0";
  public name = "Evernote";

  async process(
    files: File[],
    settings: ProviderSettings
  ): Promise<ProviderResult> {
    return iterate(this, files, async (file, notes) => {
      const enex = new Enex(file.text);
      let notebook: Notebook | undefined;
      if (enex.isNotebook) {
        notebook = {
          notebook: path.basename(file.name),
          topic: "All notes"
        };
      }

      for (const enNote of enex.notes) {
        const note: Note = {
          title: enNote.title,
          tags: enNote.tags,
          dateCreated: enNote.created?.getTime(),
          dateEdited: enNote.updated?.getTime(),
          attachments: [],
          notebooks: notebook ? [notebook] : []
        };

        const elementHandler = new ElementHandler(
          note,
          enNote,
          settings.hasher
        );
        const html = await enNote.content.toHtml(elementHandler);
        note.content = {
          data: html,
          type: ContentType.HTML
        };
        notes.push(note);
      }
      return true;
    });
  }
}
